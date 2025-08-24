/**
 * Process Executor
 * Runs node execution in a separate child process for maximum isolation
 */

const vm = require('vm');

// Listen for execution request from parent process
process.on('message', async (message) => {
  try {
    const { request, allowedModules, allowedBuiltins } = JSON.parse(message);
    
    // Execute the node in a secure context
    const result = await executeNodeInProcess(request, allowedModules, allowedBuiltins);
    
    // Send success result back to parent
    process.send(JSON.stringify({
      success: true,
      data: result,
    }));
    
    process.exit(0);
    
  } catch (error) {
    // Send error result back to parent
    process.send(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack,
    }));
    
    process.exit(1);
  }
});

// Create a secure execution context for the process
function createSecureProcessContext(allowedModules, allowedBuiltins) {
  // Restrict global access
  const context = {
    // Essential globals
    global: undefined,
    globalThis: undefined,
    window: undefined,
    
    // Safe globals
    console: {
      log: (...args) => {
        // In a real implementation, this would use a proper logger
        // For now, we'll suppress these logs in production
        if (process.env.NODE_ENV !== 'production') {
          console.log('[NODE]', ...args);
        }
      },
      error: (...args) => {
        // In a real implementation, this would use a proper logger
        // For now, we'll suppress these logs in production
        if (process.env.NODE_ENV !== 'production') {
          console.error('[NODE ERROR]', ...args);
        }
      },
      warn: (...args) => {
        // In a real implementation, this would use a proper logger
        // For now, we'll suppress these logs in production
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[NODE WARN]', ...args);
        }
      },
      info: (...args) => {
        // In a real implementation, this would use a proper logger
        // For now, we'll suppress these logs in production
        if (process.env.NODE_ENV !== 'production') {
          console.info('[NODE INFO]', ...args);
        }
      },
      debug: (...args) => {
        // In a real implementation, this would use a proper logger
        // For now, we'll suppress these logs in production
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[NODE DEBUG]', ...args);
        }
      },
    },
    
    // Controlled timer functions
    setTimeout: (fn, delay) => {
      if (typeof fn !== 'function') {
        throw new TypeError('Callback must be a function');
      }
      if (delay > 60000) {
        throw new Error('Timeout delay cannot exceed 60 seconds');
      }
      return setTimeout(fn, Math.max(0, delay));
    },
    clearTimeout,
    
    setInterval: (fn, interval) => {
      if (typeof fn !== 'function') {
        throw new TypeError('Callback must be a function');
      }
      if (interval < 100) {
        throw new Error('Interval cannot be less than 100ms');
      }
      if (interval > 60000) {
        throw new Error('Interval cannot exceed 60 seconds');
      }
      return setInterval(fn, interval);
    },
    clearInterval,
    
    setImmediate: (fn) => {
      if (typeof fn !== 'function') {
        throw new TypeError('Callback must be a function');
      }
      return setImmediate(fn);
    },
    clearImmediate,
    
    // Safe built-in objects
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
    ReferenceError,
    EvalError,
    URIError,
    
    // Promise support
    Promise,
    
    // Array and Object
    Array,
    Object,
    String,
    Number,
    Boolean,
    
    // Limited process access
    process: {
      env: {}, // No environment variables exposed
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      hrtime: process.hrtime,
      nextTick: process.nextTick,
    },
    
    // Safe require function
    require: createSecureRequire(allowedModules, allowedBuiltins),
    
    // Utility functions
    isNaN,
    isFinite,
    parseInt,
    parseFloat,
    encodeURI,
    encodeURIComponent,
    decodeURI,
    decodeURIComponent,
    escape: undefined, // Deprecated
    unescape: undefined, // Deprecated
  };
  
  return vm.createContext(context);
}

// Create a secure require function
function createSecureRequire(allowedModules, allowedBuiltins) {
  const moduleCache = new Map();
  
  return (moduleName) => {
    // Check cache first
    if (moduleCache.has(moduleName)) {
      return moduleCache.get(moduleName);
    }
    
    // Validate module name
    if (typeof moduleName !== 'string') {
      throw new TypeError('Module name must be a string');
    }
    
    // Check for path traversal attempts
    if (moduleName.includes('..') || moduleName.includes('/') || moduleName.includes('\\')) {
      throw new Error(`Invalid module name: ${moduleName}`);
    }
    
    // Check if it's an allowed built-in module
    if (allowedBuiltins.includes(moduleName)) {
      try {
        const module = require(moduleName);
        moduleCache.set(moduleName, module);
        return module;
      } catch (error) {
        throw new Error(`Failed to load built-in module '${moduleName}': ${error.message}`);
      }
    }
    
    // Check if it's an allowed external module
    if (allowedModules.includes(moduleName)) {
      try {
        const module = require(moduleName);
        moduleCache.set(moduleName, module);
        return module;
      } catch (error) {
        throw new Error(`Module '${moduleName}' is not available: ${error.message}`);
      }
    }
    
    // Provide safe mock implementations for restricted modules
    const safeMocks = {
      'fs': {
        readFile: () => {
          throw new Error('File system access is not allowed in sandbox');
        },
        writeFile: () => {
          throw new Error('File system access is not allowed in sandbox');
        },
        readFileSync: () => {
          throw new Error('File system access is not allowed in sandbox');
        },
        writeFileSync: () => {
          throw new Error('File system access is not allowed in sandbox');
        },
        existsSync: () => false,
        statSync: () => {
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
        execSync: () => {
          throw new Error('Child process access is not allowed in sandbox');
        },
        fork: () => {
          throw new Error('Child process access is not allowed in sandbox');
        },
      },
      
      'cluster': {
        fork: () => {
          throw new Error('Cluster access is not allowed in sandbox');
        },
      },
      
      'os': {
        hostname: () => 'sandbox',
        platform: () => process.platform,
        arch: () => process.arch,
        cpus: () => [],
        freemem: () => 0,
        totalmem: () => 0,
        uptime: () => 0,
        loadavg: () => [0, 0, 0],
        networkInterfaces: () => ({}),
        homedir: () => '/sandbox',
        tmpdir: () => '/tmp',
        userInfo: () => ({ username: 'sandbox', uid: 1000, gid: 1000, shell: '/bin/sh', homedir: '/sandbox' }),
      },
      
      'net': {
        createServer: () => {
          throw new Error('Network server creation is not allowed in sandbox');
        },
        connect: () => {
          throw new Error('Direct network connections are not allowed in sandbox');
        },
      },
      
      'dgram': {
        createSocket: () => {
          throw new Error('UDP socket creation is not allowed in sandbox');
        },
      },
    };
    
    if (safeMocks[moduleName]) {
      const mock = safeMocks[moduleName];
      moduleCache.set(moduleName, mock);
      return mock;
    }
    
    throw new Error(`Module '${moduleName}' is not allowed in sandbox environment`);
  };
}

// Execute node code in the secure process context
async function executeNodeInProcess(request, allowedModules, allowedBuiltins) {
  const context = createSecureProcessContext(allowedModules, allowedBuiltins);
  
  // Prepare the execution environment
  const executionCode = `
    (async function() {
      'use strict';
      
      // Execution context and data
      const executionContext = ${JSON.stringify(request.context)};
      const parameters = ${JSON.stringify(request.parameters)};
      const inputData = ${JSON.stringify(request.inputData)};
      const credentials = ${JSON.stringify(request.credentials || {})};
      
      // Helper functions for node execution
      const helpers = {
        getParameter: function(name, defaultValue) {
          return parameters[name] !== undefined ? parameters[name] : defaultValue;
        },
        
        getRequiredParameter: function(name) {
          const value = parameters[name];
          if (value === undefined || value === null || value === '') {
            throw new Error(\`Required parameter '\${name}' is missing or empty\`);
          }
          return value;
        },
        
        validateRequired: function(fields) {
          if (!Array.isArray(fields)) {
            throw new TypeError('Fields must be an array');
          }
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
          return [{ 
            json: json || {}, 
            binary: binary || {},
            pairedItem: { item: 0 }
          }];
        },
        
        createMultipleResults: function(items) {
          if (!Array.isArray(items)) {
            throw new TypeError('Items must be an array');
          }
          return items.map((item, index) => ({
            json: item.json || item,
            binary: item.binary || {},
            pairedItem: { item: index }
          }));
        },
        
        httpRequest: async function(options) {
          if (!options || typeof options !== 'object') {
            throw new TypeError('HTTP options must be an object');
          }
          if (!options.url) {
            throw new Error('URL is required for HTTP requests');
          }
          
          // Use axios for HTTP requests (if available)
          const axios = require('axios');
          
          try {
            const response = await axios({
              method: options.method || 'GET',
              url: options.url,
              headers: options.headers || {},
              data: options.body || options.data,
              params: options.params || options.query,
              timeout: Math.min(options.timeout || 30000, 60000), // Max 60s
              maxRedirects: Math.min(options.maxRedirects || 5, 10), // Max 10 redirects
              validateStatus: () => true, // Don't throw on HTTP errors
            });
            
            return {
              statusCode: response.status,
              headers: response.headers,
              body: response.data,
              url: response.config.url,
            };
          } catch (error) {
            throw new Error(\`HTTP request failed: \${error.message}\`);
          }
        },
        
        interpolate: function(template, data) {
          if (typeof template !== 'string') {
            return template;
          }
          if (!data || typeof data !== 'object') {
            return template;
          }
          
          return template.replace(/\\{\\{([^}]+)\\}\\}/g, (match, path) => {
            try {
              const value = path.trim().split('.').reduce((obj, key) => obj?.[key], data);
              return value !== undefined ? String(value) : match;
            } catch {
              return match;
            }
          });
        },
        
        parseJSON: function(jsonString, fallback) {
          try {
            return JSON.parse(jsonString);
          } catch {
            return fallback !== undefined ? fallback : null;
          }
        },
        
        validateEmail: function(email) {
          const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
          return emailRegex.test(email);
        },
        
        validateUrl: function(url) {
          try {
            new URL(url);
            return true;
          } catch {
            return false;
          }
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
        
        // Validate result format
        if (!Array.isArray(result)) {
          throw new Error('Node execution must return an array');
        }
        
        return result;
      } else {
        throw new Error('Node code must export an execute function');
      }
    })();
  `;
  
  // Create and run the script with timeout
  const script = new vm.Script(executionCode, {
    filename: 'secure-node-execution.js',
    timeout: request.context.timeout || 30000,
  });
  
  try {
    const result = await script.runInContext(context, {
      timeout: request.context.timeout || 30000,
      breakOnSigint: true,
      displayErrors: true,
    });
    
    return result;
  } catch (error) {
    // Enhance error information
    if (error.name === 'Error' && error.message.includes('Script execution timed out')) {
      throw new Error(`Node execution timed out after ${request.context.timeout || 30000}ms`);
    }
    throw error;
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  process.send(JSON.stringify({
    success: false,
    error: `Uncaught exception: ${error.message}`,
    stack: error.stack,
  }));
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  process.send(JSON.stringify({
    success: false,
    error: `Unhandled promise rejection: ${String(reason)}`,
  }));
  process.exit(1);
});

// Set maximum execution time for the entire process
setTimeout(() => {
  process.send(JSON.stringify({
    success: false,
    error: 'Process execution timeout - maximum execution time exceeded',
  }));
  process.exit(1);
}, 120000); // 2 minutes maximum
