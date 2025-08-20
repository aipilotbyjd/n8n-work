import { Logger } from 'pino';
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { VM } from 'vm2';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';

import { ConfigService } from '../config/config.service';
import { SecurityManager, IsolationLevel } from '../security/security.manager';
import { PluginManager } from '../plugins/plugin.manager';
import { MetricsService } from '../observability/metrics.service';
import { NodeExecutionContext, NodeExecutionResult, ExecutionError } from '../types/execution.types';
import { NetworkPolicy } from '../security/network.policy';
import { ResourceLimiter } from '../security/resource.limiter';

export class ExecutionEngine extends EventEmitter {
  private readonly logger: Logger;
  private readonly config: ConfigService;
  private readonly securityManager: SecurityManager;
  private readonly pluginManager: PluginManager;
  private readonly metricsService: MetricsService;
  
  // Execution tracking
  private activeExecutions: Map<string, ExecutionSession> = new Map();
  private workerPool: Map<string, Worker> = new Map();
  private processPool: Map<string, ChildProcess> = new Map();
  
  // Resource management
  private resourceLimiter: ResourceLimiter;
  
  constructor(
    config: ConfigService,
    securityManager: SecurityManager,
    pluginManager: PluginManager,
    metricsService: MetricsService,
    logger: Logger,
  ) {
    super();
    this.config = config;
    this.securityManager = securityManager;
    this.pluginManager = pluginManager;
    this.metricsService = metricsService;
    this.logger = logger.child({ component: 'ExecutionEngine' });
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing execution engine');
    
    this.resourceLimiter = new ResourceLimiter(this.config, this.logger);
    await this.resourceLimiter.initialize();
    
    this.logger.info('Execution engine initialized');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down execution engine');
    
    // Cancel all active executions
    for (const [executionId, session] of this.activeExecutions) {
      await this.cancelExecution(executionId, 'shutdown');
    }
    
    // Cleanup worker pool
    for (const [id, worker] of this.workerPool) {
      await worker.terminate();
    }
    this.workerPool.clear();
    
    // Cleanup process pool
    for (const [id, process] of this.processPool) {
      process.kill('SIGTERM');
    }
    this.processPool.clear();
    
    if (this.resourceLimiter) {
      await this.resourceLimiter.shutdown();
    }
    
    this.logger.info('Execution engine shutdown complete');
  }

  async executeNode(context: NodeExecutionContext): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    const executionId = this.generateExecutionId();
    
    this.logger.info('Starting node execution', {
      executionId,
      stepId: context.stepId,
      nodeType: context.nodeType,
      isolationLevel: context.securityContext.isolationLevel,
    });

    try {
      // Validate resource limits
      await this.resourceLimiter.checkResourceLimits(
        context.tenantId,
        context.runtimeConfig,
      );

      // Get node implementation
      const nodeImpl = await this.pluginManager.getNodeImplementation(
        context.nodeType,
      );

      if (!nodeImpl) {
        throw new ExecutionError(
          `Node type '${context.nodeType}' not found`,
          'NODE_NOT_FOUND',
          false,
        );
      }

      // Create execution session
      const session: ExecutionSession = {
        executionId,
        stepId: context.stepId,
        nodeType: context.nodeType,
        startTime,
        context,
        status: 'running',
      };

      this.activeExecutions.set(executionId, session);

      // Execute based on isolation level
      let result: NodeExecutionResult;
      
      switch (context.securityContext.isolationLevel) {
        case IsolationLevel.VM2:
          result = await this.executeInVM2(executionId, nodeImpl, context);
          break;
        case IsolationLevel.PROCESS:
          result = await this.executeInProcess(executionId, nodeImpl, context);
          break;
        case IsolationLevel.MICROVM:
          result = await this.executeInMicroVM(executionId, nodeImpl, context);
          break;
        case IsolationLevel.WASM:
          result = await this.executeInWASM(executionId, nodeImpl, context);
          break;
        default:
          result = await this.executeInVM2(executionId, nodeImpl, context);
      }

      // Update session
      session.status = result.success ? 'success' : 'failed';
      session.endTime = Date.now();
      session.result = result;

      // Record metrics
      const duration = Date.now() - startTime;
      this.metricsService.recordNodeExecution(
        context.nodeType,
        context.tenantId,
        result.success,
        duration,
        result.metrics,
      );

      this.logger.info('Node execution completed', {
        executionId,
        stepId: context.stepId,
        success: result.success,
        duration,
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const executionError = error instanceof ExecutionError 
        ? error 
        : new ExecutionError(error.message, 'EXECUTION_ERROR', true);

      this.metricsService.recordNodeExecution(
        context.nodeType,
        context.tenantId,
        false,
        duration,
        undefined,
      );

      this.logger.error('Node execution failed', {
        executionId,
        stepId: context.stepId,
        error: executionError.message,
        code: executionError.code,
        duration,
      });

      return {
        success: false,
        outputData: '',
        errorMessage: executionError.message,
        errorCode: executionError.code,
        retryable: executionError.retryable,
        metrics: {
          executionTimeMs: duration,
          memoryUsedBytes: 0,
          cpuTimeMs: 0,
          networkRequests: 0,
          networkBytesSent: 0,
          networkBytesReceived: 0,
          fileOperations: 0,
        },
        logs: [],
      };
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  async cancelExecution(executionId: string, reason: string = 'cancelled'): Promise<void> {
    const session = this.activeExecutions.get(executionId);
    if (!session) {
      this.logger.warn('Attempted to cancel non-existent execution', { executionId });
      return;
    }

    this.logger.info('Cancelling execution', { executionId, reason });

    session.status = 'cancelled';
    session.endTime = Date.now();

    // Cleanup based on isolation type
    const worker = this.workerPool.get(executionId);
    if (worker) {
      await worker.terminate();
      this.workerPool.delete(executionId);
    }

    const process = this.processPool.get(executionId);
    if (process) {
      process.kill('SIGTERM');
      this.processPool.delete(executionId);
    }

    this.emit('executionCancelled', { executionId, reason });
  }

  private async executeInVM2(
    executionId: string,
    nodeImpl: any,
    context: NodeExecutionContext,
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    
    try {
      // Create VM2 sandbox
      const vm = new VM(this.createVM2Options(context));
      
      // Create execution context for the node
      const executionContext = {
        ...context,
        log: (message: string) => {
          logs.push(`[${new Date().toISOString()}] ${message}`);
          this.logger.debug('Node log', { executionId, message });
        },
        metrics: {
          startTime,
          networkRequests: 0,
          networkBytesSent: 0,
          networkBytesReceived: 0,
          fileOperations: 0,
        },
      };

      // Prepare the execution code
      const executionCode = this.prepareExecutionCode(nodeImpl, executionContext);
      
      // Execute in VM
      const result = vm.run(executionCode);
      
      // Wait for async execution if needed
      const output = await this.handleAsyncExecution(result);
      
      const executionTime = Date.now() - startTime;
      const memoryUsage = process.memoryUsage();

      return {
        success: true,
        outputData: JSON.stringify(output),
        errorMessage: '',
        errorCode: '',
        retryable: false,
        metrics: {
          executionTimeMs: executionTime,
          memoryUsedBytes: memoryUsage.heapUsed,
          cpuTimeMs: Math.floor(process.cpuUsage().user / 1000),
          networkRequests: executionContext.metrics.networkRequests,
          networkBytesSent: executionContext.metrics.networkBytesSent,
          networkBytesReceived: executionContext.metrics.networkBytesReceived,
          fileOperations: executionContext.metrics.fileOperations,
        },
        logs,
      };

    } catch (error) {
      throw new ExecutionError(
        `VM2 execution failed: ${error.message}`,
        'VM2_EXECUTION_ERROR',
        true,
      );
    }
  }

  private async executeInProcess(
    executionId: string,
    nodeImpl: any,
    context: NodeExecutionContext,
  ): Promise<NodeExecutionResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      // Create worker script path
      const workerScript = path.join(__dirname, '../workers/node-executor.worker.js');
      
      // Create child process with resource limits
      const process = spawn('node', [workerScript], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        env: this.createSandboxEnvironment(context),
        uid: this.config.get('security.sandbox_uid'),
        gid: this.config.get('security.sandbox_gid'),
        timeout: context.runtimeConfig.timeoutSeconds * 1000,
      });

      this.processPool.set(executionId, process);

      let stdout = '';
      let stderr = '';
      const logs: string[] = [];

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
        logs.push(`[ERROR] ${data.toString()}`);
      });

      process.on('message', (message: any) => {
        if (message.type === 'log') {
          logs.push(`[${new Date().toISOString()}] ${message.message}`);
        }
      });

      process.on('exit', (code, signal) => {
        this.processPool.delete(executionId);
        
        const executionTime = Date.now() - startTime;
        
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve({
              success: true,
              outputData: JSON.stringify(result.output),
              errorMessage: '',
              errorCode: '',
              retryable: false,
              metrics: {
                executionTimeMs: executionTime,
                memoryUsedBytes: result.metrics?.memoryUsed || 0,
                cpuTimeMs: result.metrics?.cpuTime || 0,
                networkRequests: result.metrics?.networkRequests || 0,
                networkBytesSent: result.metrics?.networkBytesSent || 0,
                networkBytesReceived: result.metrics?.networkBytesReceived || 0,
                fileOperations: result.metrics?.fileOperations || 0,
              },
              logs,
            });
          } catch (parseError) {
            reject(new ExecutionError(
              `Failed to parse process output: ${parseError.message}`,
              'PARSE_ERROR',
              false,
            ));
          }
        } else {
          reject(new ExecutionError(
            `Process execution failed with code ${code}, signal ${signal}: ${stderr}`,
            'PROCESS_EXECUTION_ERROR',
            true,
          ));
        }
      });

      process.on('error', (error) => {
        this.processPool.delete(executionId);
        reject(new ExecutionError(
          `Process spawn error: ${error.message}`,
          'PROCESS_SPAWN_ERROR',
          true,
        ));
      });

      // Send execution data to process
      process.send({
        nodeImpl: nodeImpl.toString(),
        context,
      });
    });
  }

  private async executeInMicroVM(
    executionId: string,
    nodeImpl: any,
    context: NodeExecutionContext,
  ): Promise<NodeExecutionResult> {
    // This would integrate with Firecracker or similar MicroVM technology
    // For now, fallback to process isolation with additional security
    this.logger.warn('MicroVM isolation not yet implemented, falling back to process isolation');
    return this.executeInProcess(executionId, nodeImpl, context);
  }

  private async executeInWASM(
    executionId: string,
    nodeImpl: any,
    context: NodeExecutionContext,
  ): Promise<NodeExecutionResult> {
    // This would execute nodes compiled to WebAssembly
    // For now, fallback to VM2 isolation
    this.logger.warn('WASM isolation not yet implemented, falling back to VM2 isolation');
    return this.executeInVM2(executionId, nodeImpl, context);
  }

  private createVM2Options(context: NodeExecutionContext): any {
    const networkPolicy = new NetworkPolicy(context.securityContext.networkPolicy);
    
    return {
      timeout: context.runtimeConfig.timeoutSeconds * 1000,
      sandbox: {
        // Provided APIs
        console: {
          log: (...args: any[]) => context.log?.(args.join(' ')),
          error: (...args: any[]) => context.log?.(`ERROR: ${args.join(' ')}`),
          warn: (...args: any[]) => context.log?.(`WARN: ${args.join(' ')}`),
        },
        
        // HTTP client with network policy enforcement
        fetch: networkPolicy.createRestrictedFetch(),
        
        // Utilities
        JSON,
        Math,
        Date,
        parseInt,
        parseFloat,
        encodeURIComponent,
        decodeURIComponent,
        
        // Context data
        input: context.inputData ? JSON.parse(context.inputData) : {},
        parameters: context.parameters,
        
        // Limited crypto
        crypto: {
          randomUUID: crypto.randomUUID,
          subtle: undefined, // Disable WebCrypto for security
        },
        
        // Environment variables (filtered)
        env: this.filterEnvironmentVariables(context.securityContext.environmentVariables),
      },
      
      // Security options
      wasm: false,
      eval: false,
      wasm: false,
      fixAsync: false,
    };
  }

  private createSandboxEnvironment(context: NodeExecutionContext): Record<string, string> {
    const baseEnv = {
      NODE_ENV: 'sandbox',
      NODE_OPTIONS: '--max-old-space-size=' + Math.floor(context.runtimeConfig.maxMemoryBytes / (1024 * 1024)),
    };

    // Add filtered environment variables
    const filtered = this.filterEnvironmentVariables(
      context.securityContext.environmentVariables,
    );

    return { ...baseEnv, ...filtered };
  }

  private filterEnvironmentVariables(envVars: Record<string, string>): Record<string, string> {
    const allowedPrefixes = ['NODE_', 'HTTP_', 'HTTPS_'];
    const blockedKeys = ['HOME', 'USER', 'PATH', 'PWD'];
    
    const filtered: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(envVars)) {
      if (blockedKeys.includes(key)) {
        continue;
      }
      
      if (allowedPrefixes.some(prefix => key.startsWith(prefix))) {
        filtered[key] = value;
      }
    }
    
    return filtered;
  }

  private prepareExecutionCode(nodeImpl: any, context: any): string {
    return `
      (async function() {
        try {
          const nodeFunction = ${nodeImpl.toString()};
          const result = await nodeFunction(input, parameters, context);
          return result;
        } catch (error) {
          throw new Error('Node execution failed: ' + error.message);
        }
      })();
    `;
  }

  private async handleAsyncExecution(result: any): Promise<any> {
    if (result && typeof result.then === 'function') {
      return await result;
    }
    return result;
  }

  private generateExecutionId(): string {
    return crypto.randomUUID();
  }

  getActiveExecutionCount(): number {
    return this.activeExecutions.size;
  }

  getActiveExecutions(): ExecutionSession[] {
    return Array.from(this.activeExecutions.values());
  }
}

interface ExecutionSession {
  executionId: string;
  stepId: string;
  nodeType: string;
  startTime: number;
  endTime?: number;
  context: NodeExecutionContext;
  status: 'running' | 'success' | 'failed' | 'cancelled';
  result?: NodeExecutionResult;
}
