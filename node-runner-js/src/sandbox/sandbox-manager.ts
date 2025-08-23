import { VM } from 'vm2';
import { spawn, ChildProcess } from 'child_process';
import { Logger } from 'pino';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { networkInterfaces } from 'os';

export type IsolationLevel = 'vm2' | 'process' | 'microvm';

export interface SandboxConfig {
  defaultIsolation: IsolationLevel;
  allowedEgress: string[];
  enableMicroVM: boolean;
  timeout?: number;
  memoryLimit?: number;
  cpuLimit?: number;
  diskLimit?: number;
  networkPolicy?: NetworkPolicy;
  resourceQuotas?: ResourceQuotas;
}

export interface NetworkPolicy {
  allowedDomains: string[];
  allowedIPs: string[];
  blockedDomains: string[];
  blockedIPs: string[];
  allowedPorts: number[];
  maxConnections: number;
  bandwidthLimit: number; // KB/s
}

export interface ResourceQuotas {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxDiskMB: number;
  maxNetworkMbps: number;
  maxExecutionTime: number; // seconds
  maxFileDescriptors: number;
}

export interface MicroVMConfig {
  kernelPath: string;
  rootfsPath: string;
  fireCrackerBinary: string;
  socketPath: string;
  cpuCount: number;
  memorySize: number;
  enableNetworking: boolean;
  enableLogging: boolean;
}

export interface ExecutionContext {
  nodeType: string;
  parameters: Record<string, any>;
  inputData: any;
  credentials?: Record<string, any>;
  timeout?: number;
  isolationLevel?: IsolationLevel;
  resourceLimits?: ResourceQuotas;
  networkPolicy?: NetworkPolicy;
  securityContext?: SecurityContext;
}

export interface SecurityContext {
  allowNetworkAccess: boolean;
  allowFileSystemAccess: boolean;
  allowedModules: string[];
  blockedModules: string[];
  environmentVariables: Record<string, string>;
  trustLevel: 'low' | 'medium' | 'high';
}

export interface ExecutionResult {
  success: boolean;
  outputData?: any;
  error?: string;
  logs?: string[];
  executionTime: number;
  metrics?: ExecutionMetrics;
  securityViolations?: SecurityViolation[];
}

export interface ExecutionMetrics {
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
  networkRequests: number;
  networkBytesTransferred: number;
  fileSystemOperations: number;
}

export interface SecurityViolation {
  type: 'network' | 'filesystem' | 'module' | 'resource';
  description: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
  details: Record<string, any>;
}

export class MicroVMManager {
  private logger: Logger;
  private config: MicroVMConfig;
  private activeMicroVMs = new Map<string, MicroVMInstance>();

  constructor(logger: Logger, config: MicroVMConfig) {
    this.logger = logger;
    this.config = config;
  }

  async createMicroVM(executionId: string, context: ExecutionContext): Promise<MicroVMInstance> {
    const vmId = `vm-${executionId}`;
    const socketPath = path.join(tmpdir(), `firecracker-${vmId}.sock`);
    
    // Create MicroVM configuration
    const vmConfig = {
      "boot-source": {
        "kernel_image_path": this.config.kernelPath,
        "boot_args": "console=ttyS0 reboot=k panic=1 pci=off"
      },
      "drives": [{
        "drive_id": "rootfs",
        "path_on_host": this.config.rootfsPath,
        "is_root_device": true,
        "is_read_only": false
      }],
      "machine-config": {
        "vcpu_count": this.config.cpuCount,
        "mem_size_mib": this.config.memorySize,
        "ht_enabled": false
      },
      "logger": {
        "log_path": path.join(tmpdir(), `firecracker-${vmId}.log`),
        "level": "Info",
        "show_level": true,
        "show_log_origin": true
      }
    };

    // Add networking if enabled
    if (this.config.enableNetworking && context.securityContext?.allowNetworkAccess) {
      vmConfig["network-interfaces"] = [{
        "iface_id": "eth0",
        "guest_mac": this.generateMacAddress(),
        "host_dev_name": `tap-${vmId}`
      }];
    }

    const instance = new MicroVMInstance(vmId, socketPath, vmConfig, this.logger);
    this.activeMicroVMs.set(executionId, instance);
    
    await instance.start();
    return instance;
  }

  async destroyMicroVM(executionId: string): Promise<void> {
    const instance = this.activeMicroVMs.get(executionId);
    if (instance) {
      await instance.stop();
      this.activeMicroVMs.delete(executionId);
    }
  }

  private generateMacAddress(): string {
    const hex = '0123456789ABCDEF';
    let mac = '02:'; // Locally administered unicast MAC
    for (let i = 0; i < 5; i++) {
      mac += hex[Math.floor(Math.random() * 16)];
      mac += hex[Math.floor(Math.random() * 16)];
      if (i < 4) mac += ':';
    }
    return mac;
  }
}

export class MicroVMInstance {
  private vmId: string;
  private socketPath: string;
  private config: any;
  private logger: Logger;
  private process?: ChildProcess;
  private isRunning = false;

  constructor(vmId: string, socketPath: string, config: any, logger: Logger) {
    this.vmId = vmId;
    this.socketPath = socketPath;
    this.config = config;
    this.logger = logger;
  }

  async start(): Promise<void> {
    try {
      // Start Firecracker process
      this.process = spawn('firecracker', [
        '--api-sock', this.socketPath,
        '--config-file', await this.writeConfigFile()
      ], {
        stdio: 'pipe'
      });

      this.process.on('error', (error) => {
        this.logger.error({ vmId: this.vmId, error: error.message }, 'MicroVM process error');
      });

      this.process.on('exit', (code) => {
        this.logger.info({ vmId: this.vmId, exitCode: code }, 'MicroVM process exited');
        this.isRunning = false;
      });

      // Wait for the API socket to be ready
      await this.waitForSocket();
      this.isRunning = true;
      
      this.logger.info({ vmId: this.vmId }, 'MicroVM started successfully');
    } catch (error) {
      throw new Error(`Failed to start MicroVM: ${error.message}`);
    }
  }

  async stop(): Promise<void> {
    if (this.process && this.isRunning) {
      this.process.kill('SIGTERM');
      
      // Wait for graceful shutdown, then force kill if necessary
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    }
    
    // Clean up socket file
    try {
      await fs.unlink(this.socketPath);
    } catch (error) {
      // Ignore errors when cleaning up socket
    }

    this.isRunning = false;
    this.logger.info({ vmId: this.vmId }, 'MicroVM stopped');
  }

  async executeCode(code: string, timeout: number): Promise<ExecutionResult> {
    if (!this.isRunning) {
      throw new Error('MicroVM is not running');
    }

    // This would typically involve:
    // 1. Copying the code to the VM's filesystem
    // 2. Executing it inside the VM
    // 3. Retrieving the results
    // For now, we'll simulate the execution
    
    const startTime = Date.now();
    
    try {
      // Simulate code execution with security monitoring
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: true,
        outputData: { message: 'MicroVM execution completed', vmId: this.vmId },
        executionTime,
        metrics: {
          memoryUsage: 50 * 1024 * 1024, // 50MB
          cpuUsage: 25, // 25%
          diskUsage: 10 * 1024 * 1024, // 10MB
          networkRequests: 0,
          networkBytesTransferred: 0,
          fileSystemOperations: 5
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  private async writeConfigFile(): Promise<string> {
    const configPath = path.join(tmpdir(), `firecracker-${this.vmId}.json`);
    await fs.writeFile(configPath, JSON.stringify(this.config, null, 2));
    return configPath;
  }

  private async waitForSocket(): Promise<void> {
    const maxAttempts = 30;
    const delay = 1000;
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await fs.access(this.socketPath);
        return;
      } catch (error) {
        if (i === maxAttempts - 1) {
          throw new Error('Timeout waiting for Firecracker socket');
        }
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

export class SandboxManager {
  private config: SandboxConfig;
  private logger: Logger;
  private activeExecutions = new Map<string, AbortController>();

  constructor(logger: Logger, config: SandboxConfig) {
    this.logger = logger;
    this.config = {
      timeout: 30000,
      memoryLimit: 128 * 1024 * 1024, // 128MB
      ...config,
    };
  }

  async executeNode(context: ExecutionContext): Promise<ExecutionResult> {
    const executionId = uuidv4();
    const startTime = Date.now();
    const abortController = new AbortController();
    
    this.activeExecutions.set(executionId, abortController);

    try {
      const isolationLevel = context.isolationLevel || this.config.defaultIsolation;
      
      this.logger.info({
        executionId,
        nodeType: context.nodeType,
        isolationLevel,
      }, 'Starting node execution');

      let result: ExecutionResult;

      switch (isolationLevel) {
        case 'vm2':
          result = await this.executeInVM2(context, abortController.signal);
          break;
        case 'process':
          result = await this.executeInProcess(context, abortController.signal);
          break;
        case 'microvm':
          if (!this.config.enableMicroVM) {
            throw new Error('MicroVM isolation is not enabled');
          }
          result = await this.executeInMicroVM(context, abortController.signal);
          break;
        default:
          throw new Error(`Unsupported isolation level: ${isolationLevel}`);
      }

      result.executionTime = Date.now() - startTime;
      
      this.logger.info({
        executionId,
        success: result.success,
        executionTime: result.executionTime,
      }, 'Node execution completed');

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error({
        executionId,
        error: error.message,
        executionTime,
      }, 'Node execution failed');

      return {
        success: false,
        error: error.message,
        executionTime,
      };
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  private async executeInVM2(
    context: ExecutionContext,
    abortSignal: AbortSignal
  ): Promise<ExecutionResult> {
    const vm = new VM({
      timeout: context.timeout || this.config.timeout,
      sandbox: {
        // Provide safe globals
        console: {
          log: (...args: any[]) => this.logger.info({ args }, 'VM2 console.log'),
          error: (...args: any[]) => this.logger.error({ args }, 'VM2 console.error'),
          warn: (...args: any[]) => this.logger.warn({ args }, 'VM2 console.warn'),
        },
        require: this.createSafeRequire(),
        Buffer,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        Promise,
        JSON,
      },
    });

    try {
      // Build the execution script
      const script = this.buildNodeScript(context);
      
      // Execute in VM2
      const result = await vm.run(script);
      
      return {
        success: true,
        outputData: result,
        executionTime: 0, // Will be set by caller
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        executionTime: 0,
      };
    }
  }

  private async executeInProcess(
    context: ExecutionContext,
    abortSignal: AbortSignal
  ): Promise<ExecutionResult> {
    const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'n8n-work-'));
    const scriptPath = path.join(tempDir, 'node-script.js');
    
    try {
      // Write the execution script to a temporary file
      const script = this.buildNodeScript(context);
      await fs.writeFile(scriptPath, script);

      // Execute in child process
      const result = await this.executeChildProcess(scriptPath, abortSignal);
      
      return result;
    } finally {
      // Clean up temporary files
      try {
        await fs.rm(tempDir, { recursive: true });
      } catch (error) {
        this.logger.warn({ error: error.message }, 'Failed to clean up temp directory');
      }
    }
  }

  private async executeInMicroVM(
    context: ExecutionContext,
    abortSignal: AbortSignal
  ): Promise<ExecutionResult> {
    // MicroVM implementation would use Firecracker or similar
    // This is a placeholder for the actual implementation
    throw new Error('MicroVM isolation not yet implemented');
  }

  private async executeChildProcess(
    scriptPath: string,
    abortSignal: AbortSignal
  ): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const logs: string[] = [];
      let stdout = '';
      let stderr = '';

      const child: ChildProcess = spawn('node', [scriptPath], {
        stdio: 'pipe',
        env: {
          ...process.env,
          NODE_ENV: 'sandbox',
        },
      });

      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        resolve({
          success: false,
          error: 'Execution timeout',
          logs,
          executionTime: 0,
        });
      }, this.config.timeout);

      abortSignal.addEventListener('abort', () => {
        clearTimeout(timeout);
        child.kill('SIGKILL');
        resolve({
          success: false,
          error: 'Execution aborted',
          logs,
          executionTime: 0,
        });
      });

      child.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        logs.push(`stdout: ${output.trim()}`);
      });

      child.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        logs.push(`stderr: ${output.trim()}`);
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve({
              success: true,
              outputData: result,
              logs,
              executionTime: 0,
            });
          } catch (error) {
            resolve({
              success: false,
              error: `Failed to parse result: ${error.message}`,
              logs,
              executionTime: 0,
            });
          }
        } else {
          resolve({
            success: false,
            error: `Process exited with code ${code}: ${stderr}`,
            logs,
            executionTime: 0,
          });
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: error.message,
          logs,
          executionTime: 0,
        });
      });
    });
  }

  private buildNodeScript(context: ExecutionContext): string {
    // This would typically load the actual node implementation
    // For now, we'll create a simple template
    return `
      const { nodeType, parameters, inputData, credentials } = ${JSON.stringify(context)};
      
      try {
        // Simulate node execution
        const result = {
          message: \`Node \${nodeType} executed successfully\`,
          parameters,
          inputData,
          timestamp: new Date().toISOString(),
        };
        
        // For process isolation, output to stdout
        if (typeof process !== 'undefined') {
          process.stdout.write(JSON.stringify(result));
          process.exit(0);
        }
        
        // For VM2, return the result
        result;
      } catch (error) {
        if (typeof process !== 'undefined') {
          process.stderr.write(error.message);
          process.exit(1);
        }
        throw error;
      }
    `;
  }

  private createSafeRequire() {
    // Create a safe require function for VM2 that only allows specific modules
    const allowedModules = [
      'lodash',
      'moment',
      'crypto',
      'uuid',
      'axios',
      'cheerio',
      'xml2js',
    ];

    return (moduleName: string) => {
      if (allowedModules.includes(moduleName)) {
        return require(moduleName);
      }
      throw new Error(`Module '${moduleName}' is not allowed in sandbox`);
    };
  }

  async cancelExecution(executionId: string): Promise<boolean> {
    const abortController = this.activeExecutions.get(executionId);
    if (abortController) {
      abortController.abort();
      return true;
    }
    return false;
  }

  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys());
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down sandbox manager...');
    
    // Cancel all active executions
    for (const [executionId, abortController] of this.activeExecutions) {
      this.logger.info({ executionId }, 'Cancelling active execution');
      abortController.abort();
    }
    
    this.activeExecutions.clear();
  }
}
