/**
 * Dev command - Start development server
 */

import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import express from 'express';
import cors from 'cors';
import chokidar from 'chokidar';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import open from 'open';
import { buildNodeCommand } from './build';

export interface DevOptions {
  port: string;
  host: string;
  hotReload: boolean;
  open: boolean;
}

/**
 * Start development server with hot reload
 */
export async function devCommand(options: DevOptions): Promise<void> {
  const port = parseInt(options.port, 10);
  const spinner = ora('Starting development server...').start();

  try {
    // Create Express app
    const app = express();
    const server = createServer(app);
    
    // Enable CORS
    app.use(cors());
    app.use(express.json());
    app.use(express.static(path.join(process.cwd(), 'dist')));

    // Setup WebSocket for hot reload
    let wss: WebSocketServer | null = null;
    if (options.hotReload) {
      wss = new WebSocketServer({ server });
      setupHotReload(wss);
    }

    // API endpoints
    setupApiEndpoints(app);

    // File watcher for auto-rebuild
    setupFileWatcher(wss);

    // Start server
    server.listen(port, options.host, () => {
      spinner.succeed(chalk.green('Development server started'));
      
      console.log(chalk.cyan(`
🚀 N8N-Work Node Development Server

  Local:    http://${options.host}:${port}
  Network:  http://localhost:${port}

📁 Serving files from: ${path.join(process.cwd(), 'dist')}
🔥 Hot reload: ${options.hotReload ? 'enabled' : 'disabled'}

Press Ctrl+C to stop the server
      `));

      // Open browser if requested
      if (options.open) {
        open(`http://${options.host}:${port}`);
      }
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\nShutting down development server...'));
      server.close(() => {
        console.log(chalk.green('Development server stopped'));
        process.exit(0);
      });
    });

  } catch (error) {
    spinner.fail(chalk.red('Failed to start development server'));
    throw error;
  }
}

/**
 * Setup API endpoints for the development server
 */
function setupApiEndpoints(app: express.Application): void {
  // Get list of available nodes
  app.get('/api/nodes', async (req, res) => {
    try {
      const distPath = path.join(process.cwd(), 'dist');
      const nodeFiles = await getNodeFiles(distPath);
      
      const nodes = await Promise.all(
        nodeFiles.map(async (file) => {
          try {
            const nodeModule = require(file);
            const nodeClass = nodeModule.default || nodeModule;
            
            if (nodeClass && nodeClass.prototype && nodeClass.prototype.nodeType) {
              const instance = new nodeClass();
              return {
                file: path.relative(distPath, file),
                type: instance.nodeType,
                name: instance.nodeType.name,
                displayName: instance.nodeType.displayName,
                description: instance.nodeType.description,
                version: instance.nodeType.version,
                group: instance.nodeType.group,
              };
            }
            
            return null;
          } catch (error) {
            console.warn(chalk.yellow(`Warning: Failed to load node from ${file}`));
            return null;
          }
        })
      );

      res.json({
        nodes: nodes.filter(Boolean),
        count: nodes.filter(Boolean).length,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to load nodes',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Get specific node details
  app.get('/api/nodes/:name', async (req, res) => {
    try {
      const nodeName = req.params.name;
      const distPath = path.join(process.cwd(), 'dist');
      const nodeFiles = await getNodeFiles(distPath);
      
      for (const file of nodeFiles) {
        try {
          const nodeModule = require(file);
          const nodeClass = nodeModule.default || nodeModule;
          
          if (nodeClass && nodeClass.prototype && nodeClass.prototype.nodeType) {
            const instance = new nodeClass();
            
            if (instance.nodeType.name === nodeName) {
              res.json({
                file: path.relative(distPath, file),
                type: instance.nodeType,
                source: await fs.readFile(file, 'utf-8'),
              });
              return;
            }
          }
        } catch (error) {
          // Continue to next file
        }
      }
      
      res.status(404).json({
        error: 'Node not found',
        name: nodeName,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to load node',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Test node execution
  app.post('/api/nodes/:name/test', async (req, res) => {
    try {
      const nodeName = req.params.name;
      const { context, data } = req.body;
      
      // Find and load the node
      const distPath = path.join(process.cwd(), 'dist');
      const nodeFiles = await getNodeFiles(distPath);
      
      for (const file of nodeFiles) {
        try {
          const nodeModule = require(file);
          const nodeClass = nodeModule.default || nodeModule;
          
          if (nodeClass && nodeClass.prototype && nodeClass.prototype.nodeType) {
            const instance = new nodeClass();
            
            if (instance.nodeType.name === nodeName) {
              // Execute the node with test data
              const result = await instance.execute(context, data);
              
              res.json({
                success: true,
                result,
                executedAt: new Date().toISOString(),
              });
              return;
            }
          }
        } catch (error) {
          // Continue to next file
        }
      }
      
      res.status(404).json({
        error: 'Node not found',
        name: nodeName,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Node execution failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Serve development UI
  app.get('/', (req, res) => {
    res.send(generateDevUI());
  });
}

/**
 * Setup WebSocket hot reload functionality
 */
function setupHotReload(wss: WebSocketServer): void {
  wss.on('connection', (ws) => {
    console.log(chalk.blue('Client connected to hot reload'));
    
    ws.on('close', () => {
      console.log(chalk.blue('Client disconnected from hot reload'));
    });
  });
}

/**
 * Setup file watcher for auto-rebuild
 */
function setupFileWatcher(wss: WebSocketServer | null): void {
  const watcher = chokidar.watch(['src/**/*.ts', 'src/**/*.js'], {
    ignored: /node_modules/,
    persistent: true,
  });

  let rebuildTimeout: NodeJS.Timeout;

  watcher.on('change', (filePath) => {
    console.log(chalk.yellow(`File changed: ${filePath}`));
    
    // Debounce rebuilds
    clearTimeout(rebuildTimeout);
    rebuildTimeout = setTimeout(async () => {
      try {
        console.log(chalk.blue('Rebuilding...'));
        
        // Clear require cache for the changed file
        const absolutePath = path.resolve(filePath);
        delete require.cache[absolutePath];
        
        // Rebuild nodes
        await buildNodeCommand('**/*.node.ts', {
          output: './dist',
          watch: false,
          minify: false,
          sourcemap: true,
        });
        
        console.log(chalk.green('Rebuild complete'));
        
        // Notify clients via WebSocket
        if (wss) {
          wss.clients.forEach((ws) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                type: 'reload',
                file: filePath,
                timestamp: Date.now(),
              }));
            }
          });
        }
      } catch (error) {
        console.error(chalk.red('Rebuild failed:'), error instanceof Error ? error.message : String(error));
      }
    }, 1000);
  });

  // Handle shutdown
  process.on('SIGINT', () => {
    watcher.close();
  });
}

/**
 * Get all node files from directory
 */
async function getNodeFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await getNodeFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.name.endsWith('.node.js')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
  }
  
  return files;
}

/**
 * Generate development UI HTML
 */
function generateDevUI(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>N8N-Work Node Development Server</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
        }
        .content {
            padding: 20px;
        }
        .node-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        .node-card {
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            padding: 16px;
            background: #f9f9f9;
        }
        .node-name {
            font-weight: 600;
            font-size: 18px;
            margin-bottom: 8px;
            color: #333;
        }
        .node-description {
            color: #666;
            margin-bottom: 12px;
        }
        .node-meta {
            display: flex;
            gap: 10px;
            font-size: 12px;
        }
        .badge {
            background: #667eea;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
        }
        .status {
            margin-top: 20px;
            padding: 16px;
            background: #e8f5e8;
            border-radius: 6px;
            border-left: 4px solid #4caf50;
        }
        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 N8N-Work Node Development Server</h1>
            <p>Monitor and test your custom workflow nodes in real-time</p>
        </div>
        <div class="content">
            <div class="status">
                <strong>Server Status:</strong> Running ✅
                <br>
                <strong>Hot Reload:</strong> <span id="hot-reload-status">Connecting...</span>
            </div>
            
            <h2>Available Nodes</h2>
            <div id="node-list" class="loading">
                Loading nodes...
            </div>
        </div>
    </div>

    <script>
        // WebSocket connection for hot reload
        const ws = new WebSocket(\`ws://\${window.location.host}\`);
        const hotReloadStatus = document.getElementById('hot-reload-status');
        
        ws.onopen = () => {
            hotReloadStatus.textContent = 'Connected ✅';
            hotReloadStatus.style.color = 'green';
        };
        
        ws.onclose = () => {
            hotReloadStatus.textContent = 'Disconnected ❌';
            hotReloadStatus.style.color = 'red';
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'reload') {
                console.log('Hot reload triggered for:', data.file);
                setTimeout(() => {
                    loadNodes();
                }, 500);
            }
        };

        // Load and display nodes
        async function loadNodes() {
            try {
                const response = await fetch('/api/nodes');
                const data = await response.json();
                
                const nodeList = document.getElementById('node-list');
                
                if (data.nodes.length === 0) {
                    nodeList.innerHTML = '<p>No nodes found. Create some nodes to get started!</p>';
                    return;
                }
                
                nodeList.innerHTML = data.nodes.map(node => \`
                    <div class="node-card">
                        <div class="node-name">\${node.displayName}</div>
                        <div class="node-description">\${node.description}</div>
                        <div class="node-meta">
                            <span class="badge">\${node.group}</span>
                            <span class="badge">v\${node.version}</span>
                            <span class="badge">\${node.name}</span>
                        </div>
                    </div>
                \`).join('');
                
            } catch (error) {
                document.getElementById('node-list').innerHTML = 
                    \`<p style="color: red;">Error loading nodes: \${error.message}</p>\`;
            }
        }

        // Initial load
        loadNodes();
        
        // Refresh every 10 seconds
        setInterval(loadNodes, 10000);
    </script>
</body>
</html>
  `;
}
