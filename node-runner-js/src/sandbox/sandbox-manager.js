import { VM } from 'vm2';
import ivm from 'isolated-vm';

export class SandboxManager {
  constructor(logger, config) {
    this.logger = logger;
    this.defaultIsolation = config.defaultIsolation || 'vm2';
    this.allowedEgress = config.allowedEgress || [];
    this.enableMicroVM = config.enableMicroVM || false;
    this.sandboxes = new Map();
  }

  async executeNode(executionData) {
    const { nodeType, parameters, inputData, isolationLevel, timeout = 30000 } = executionData;
    
    const isolation = isolationLevel || this.defaultIsolation;
    
    this.logger.info('Executing node in sandbox', {
      nodeType,
      isolation,
      timeout
    });

    try {
      let result;
      
      switch (isolation) {
        case 'vm2':
          result = await this.executeInVM2(executionData, timeout);
          break;
        case 'isolated-vm':
          result = await this.executeInIsolatedVM(executionData, timeout);
          break;
        case 'microvm':
          if (this.enableMicroVM) {
            result = await this.executeInMicroVM(executionData, timeout);
          } else {
            throw new Error('MicroVM isolation is not enabled');
          }
          break;
        default:
          throw new Error(`Unknown isolation level: ${isolation}`);
      }
      
      this.logger.info('Node execution completed', {
        nodeType,
        success: true
      });
      
      return {
        success: true,
        output: result,
        executionTime: Date.now()
      };
    } catch (error) {
      this.logger.error('Node execution failed', {
        nodeType,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message,
        executionTime: Date.now()
      };
    }
  }

  async executeInVM2(executionData, timeout) {
    const { nodeType, parameters, inputData, code } = executionData;
    
    const vm = new VM({
      timeout,
      sandbox: {
        console: {
          log: (...args) => this.logger.info('VM Console:', ...args),
          error: (...args) => this.logger.error('VM Console:', ...args)
        },
        inputData,
        parameters,
        require: {
          external: false,
          builtin: ['util', 'path', 'url', 'querystring', 'crypto'],
          root: './',
          mock: {
            'node-fetch': fetch
          }
        }
      },
      fixAsync: true,
      eval: false,
      wasm: false
    });
    
    try {
      const script = code || this.getNodeScript(nodeType);
      return vm.run(script);
    } finally {
      // Clean up VM resources
      if (vm) {
        // VM2 doesn't have explicit cleanup
      }
    }
  }

  async executeInIsolatedVM(executionData, timeout) {
    const { nodeType, parameters, inputData, code } = executionData;
    
    // Create a new isolate with memory limit
    const isolate = new ivm.Isolate({ memoryLimit: 128 });
    
    try {
      // Create a context within the isolate
      const context = await isolate.createContext();
      
      // Get reference to global object
      const jail = context.global;
      
      // Set up sandbox environment
      await jail.set('global', jail.derefInto());
      await jail.set('inputData', new ivm.ExternalCopy(inputData).copyInto());
      await jail.set('parameters', new ivm.ExternalCopy(parameters).copyInto());
      
      // Set up console
      await jail.set('log', new ivm.Reference((...args) => {
        this.logger.info('IVM Console:', ...args);
      }));
      
      // Compile and run the script
      const script = await isolate.compileScript(code || this.getNodeScript(nodeType));
      const result = await script.run(context, { timeout });
      
      // Get the result
      if (result && typeof result.copy === 'function') {
        return await result.copy();
      }
      return result;
    } finally {
      // Clean up isolate
      isolate.dispose();
    }
  }

  async executeInMicroVM(executionData, timeout) {
    // This would integrate with Firecracker or similar microVM technology
    this.logger.info('MicroVM execution not yet implemented');
    throw new Error('MicroVM execution not yet implemented');
  }

  getNodeScript(nodeType) {
    // Get pre-defined script for node type
    const scripts = {
      'http': `
        const fetch = require('node-fetch');
        const response = await fetch(parameters.url, {
          method: parameters.method || 'GET',
          headers: parameters.headers || {},
          body: parameters.body ? JSON.stringify(parameters.body) : undefined
        });
        return {
          status: response.status,
          body: await response.json()
        };
      `,
      'transform': `
        return parameters.transform ? eval(parameters.transform)(inputData) : inputData;
      `,
      'function': `
        return eval(parameters.code)(inputData, parameters);
      `
    };
    
    return scripts[nodeType] || 'return inputData;';
  }

  async createSandbox(sandboxId, config) {
    const sandbox = {
      id: sandboxId,
      created: Date.now(),
      config,
      executions: 0
    };
    
    this.sandboxes.set(sandboxId, sandbox);
    return sandbox;
  }

  async destroySandbox(sandboxId) {
    const sandbox = this.sandboxes.get(sandboxId);
    if (sandbox) {
      // Clean up sandbox resources
      this.sandboxes.delete(sandboxId);
      this.logger.info('Sandbox destroyed', { sandboxId });
    }
  }

  getSandboxStats() {
    const stats = {
      total: this.sandboxes.size,
      sandboxes: []
    };
    
    for (const [id, sandbox] of this.sandboxes) {
      stats.sandboxes.push({
        id,
        created: sandbox.created,
        executions: sandbox.executions
      });
    }
    
    return stats;
  }
}
