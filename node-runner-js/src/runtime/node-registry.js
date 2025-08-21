export class NodeRegistry {
  constructor(logger) {
    this.logger = logger;
    this.nodes = new Map();
    this.nodeTypes = new Map();
  }

  async loadBuiltInNodes() {
    try {
      // Load built-in node types
      const builtInNodes = [
        { type: 'http', handler: this.createHttpNodeHandler() },
        { type: 'function', handler: this.createFunctionNodeHandler() },
        { type: 'database', handler: this.createDatabaseNodeHandler() },
        { type: 'webhook', handler: this.createWebhookNodeHandler() },
        { type: 'email', handler: this.createEmailNodeHandler() },
        { type: 'delay', handler: this.createDelayNodeHandler() },
        { type: 'transform', handler: this.createTransformNodeHandler() },
        { type: 'conditional', handler: this.createConditionalNodeHandler() },
      ];

      for (const node of builtInNodes) {
        this.registerNodeType(node.type, node.handler);
      }

      this.logger.info('Built-in nodes loaded successfully', {
        count: builtInNodes.length
      });
    } catch (error) {
      this.logger.error('Failed to load built-in nodes', error);
      throw error;
    }
  }

  registerNodeType(type, handler) {
    this.nodeTypes.set(type, handler);
    this.logger.debug('Node type registered', { type });
  }

  getNodeHandler(type) {
    return this.nodeTypes.get(type);
  }

  hasNodeType(type) {
    return this.nodeTypes.has(type);
  }

  // Built-in node handlers
  createHttpNodeHandler() {
    return async (context, parameters) => {
      const { url, method = 'GET', headers = {}, body } = parameters;
      
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined
        });
        
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers),
          body: await response.json()
        };
      } catch (error) {
        throw new Error(`HTTP request failed: ${error.message}`);
      }
    };
  }

  createFunctionNodeHandler() {
    return async (context, parameters) => {
      const { code } = parameters;
      
      try {
        // Create sandboxed function execution
        const fn = new Function('context', code);
        return fn(context);
      } catch (error) {
        throw new Error(`Function execution failed: ${error.message}`);
      }
    };
  }

  createDatabaseNodeHandler() {
    return async (context, parameters) => {
      const { query, connection } = parameters;
      
      // This would connect to actual database
      this.logger.info('Executing database query', { query });
      
      return {
        rows: [],
        rowCount: 0
      };
    };
  }

  createWebhookNodeHandler() {
    return async (context, parameters) => {
      const { url, method = 'POST', payload } = parameters;
      
      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        return {
          success: response.ok,
          status: response.status,
          response: await response.json()
        };
      } catch (error) {
        throw new Error(`Webhook call failed: ${error.message}`);
      }
    };
  }

  createEmailNodeHandler() {
    return async (context, parameters) => {
      const { to, subject, body, from } = parameters;
      
      this.logger.info('Sending email', { to, subject });
      
      // This would integrate with email service
      return {
        success: true,
        messageId: `msg-${Date.now()}`
      };
    };
  }

  createDelayNodeHandler() {
    return async (context, parameters) => {
      const { duration = 1000 } = parameters;
      
      await new Promise(resolve => setTimeout(resolve, duration));
      
      return {
        delayed: true,
        duration
      };
    };
  }

  createTransformNodeHandler() {
    return async (context, parameters) => {
      const { transform } = parameters;
      
      try {
        // Apply transformation
        const fn = new Function('data', transform);
        return fn(context.inputData);
      } catch (error) {
        throw new Error(`Transform failed: ${error.message}`);
      }
    };
  }

  createConditionalNodeHandler() {
    return async (context, parameters) => {
      const { condition, trueBranch, falseBranch } = parameters;
      
      try {
        const fn = new Function('context', `return ${condition}`);
        const result = fn(context);
        
        return {
          condition: result,
          branch: result ? trueBranch : falseBranch
        };
      } catch (error) {
        throw new Error(`Conditional evaluation failed: ${error.message}`);
      }
    };
  }
}
