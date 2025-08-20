/**
 * Worker Thread Executor
 * Runs node execution in a separate worker thread for isolation
 */

const { parentPort, workerData } = require('worker_threads');
const vm = require('vm');

// Worker data contains the execution request and configuration
const { request, allowedModules, allowedBuiltins } = workerData;

// Create a secure execution context
const createSecureContext = () => {
  const context = {
    // Safe globals
    console: {
      log: (...args) => {
        parentPort?.postMessage({
          type: 'log',
          level: 'info',
          args: args.map(String),
        });
      },
      error: (...args) => {
        parentPort?.postMessage({
          type: 'log',
          level: 'error',
          args: args.map(String),
        });
      },
      warn: (...args) => {
        parentPort?.postMessage({
          type: 'log',
          level: 'warn',
          args: args.map(String),
        });
      },
    },
    
    // Timer functions (with limits)
    setTimeout: (fn, delay) => {
      if (delay > 60000) {
        throw new Error('Timeout delay cannot exceed 60 seconds');
      }
      return setTimeout(fn, delay);
    },
    clearTimeout,
    setInterval: (fn, interval) => {
      if (interval < 100) {
        throw new Error('Interval cannot be less than 100ms');
      }
      if (interval > 60000) {
        throw new Error('Interval cannot exceed 60 seconds');
      }
      return setInterval(fn, interval);
    },
    clearInterval,
    
    // Safe utilities
    Buffer,
    URL,
    URLSearchParams,
    JSON,
    Math,
    Date,
    RegExp,
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    
    // Promise support
    Promise,
    
    // Node.js specific
    process: {
      env: {},
      version: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    
    // Safe require function
    require: createSafeRequire(allowedModules, allowedBuiltins),
  };
  
  // Create VM context
  return vm.createContext(context);
};

// Create a safe require function that only allows specific modules
function createSafeRequire(allowedModules, allowedBuiltins) {
  return (moduleName) => {
    // Check if it's an allowed built-in module
    if (allowedBuiltins.includes(moduleName)) {
      return require(moduleName);
    }
    
    // Check if it's an allowed external module
    if (allowedModules.includes(moduleName)) {
      try {
        return require(moduleName);
      } catch (error) {
        throw new Error(`Module '${moduleName}' is not available: ${error.message}`);
      }
    }
    
    // Provide mock implementations for restricted modules
    const mocks = {
      'fs': {
        readFile: () => {
          throw new Error('File system access is not allowed in sandbox');
        },
        writeFile: () => {
          throw new Error('File system access is not allowed in sandbox');
        },
      },
      'child_process': {
        spawn: () => {
          throw new Error('Child process access is not allowed in sandbox');
        },
        exec: () => {
          throw new Error('Child process access is not allowed in sandbox');
        },
      },
      'os': {
        hostname: () => 'sandbox',
        platform: () => process.platform,
        arch: () => process.arch,
        cpus: () => [],
        freemem: () => 0,
        totalmem: () => 0,
      },
    };
    
    if (mocks[moduleName]) {
      return mocks[moduleName];
    }
    
    throw new Error(`Module '${moduleName}' is not allowed in sandbox environment`);
  };
}

// Execute the node code
async function executeNode() {
  try {
    const context = createSecureContext();
    
    // Prepare execution code with context
    const executionCode = `
      (async function() {
        'use strict';
        
        // Execution context and data
        const executionContext = ${JSON.stringify(request.context)};
        const parameters = ${JSON.stringify(request.parameters)};
        const inputData = ${JSON.stringify(request.inputData)};
        const credentials = ${JSON.stringify(request.credentials || {})};
        
        // Helper functions
        const helpers = {
          getParameter: function(name, defaultValue) {
            return parameters[name] !== undefined ? parameters[name] : defaultValue;
          },
          
          validateRequired: function(fields) {
            const missing = fields.filter(field => 
              parameters[field] === undefined || 
              parameters[field] === null || 
              parameters[field] === ''
            );
            if (missing.length > 0) {
              throw new Error('Missing required parameters: ' + missing.join(', '));
            }
          },
          
          createResult: function(json, binary) {
            return [{ json: json || {}, binary: binary || {} }];
          },
          
          httpRequest: async function(options) {
            // Use axios for HTTP requests (if available)
            const axios = require('axios');
            
            try {
              const response = await axios({
                method: options.method || 'GET',
                url: options.url,
                headers: options.headers || {},
                data: options.body || options.data,
                timeout: options.timeout || 30000,
                validateStatus: () => true, // Don't throw on HTTP errors
              });
              
              return {
                statusCode: response.status,
                headers: response.headers,
                body: response.data,
              };
            } catch (error) {
              throw new Error(\`HTTP request failed: \${error.message}\`);
            }
          },
          
          interpolate: function(template, data) {
            return template.replace(/\\{\\{([^}]+)\\}\\}/g, (match, path) => {
              const value = path.split('.').reduce((obj, key) => obj?.[key], data);
              return value !== undefined ? String(value) : match;
            });
          },
        };
        
        // Node execution code
        ${request.nodeCode}
        
        // Execute the node
        if (typeof execute === 'function') {
          const result = await execute(executionContext, {
            parameters,
            inputData,
            credentials,
          }, helpers);
          
          return result || [];
        } else {
          throw new Error('Node code must export an execute function');
        }
      })();
    `;
    
    // Run the code in the secure context
    const script = new vm.Script(executionCode, {
      filename: 'node-execution.js',
      timeout: request.context.timeout || 30000,
    });
    
    const result = await script.runInContext(context, {
      timeout: request.context.timeout || 30000,
      breakOnSigint: true,
    });
    
    // Send success result back to main thread
    parentPort?.postMessage({
      success: true,
      data: result,
    });
    
  } catch (error) {
    // Send error result back to main thread
    parentPort?.postMessage({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  parentPort?.postMessage({
    success: false,
    error: `Uncaught exception: ${error.message}`,
    stack: error.stack,
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  parentPort?.postMessage({
    success: false,
    error: `Unhandled promise rejection: ${reason}`,
  });
  process.exit(1);
});

// Start execution
executeNode();
