#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { createNode } from './commands/create';
import { buildNode } from './commands/build';
import { testNode } from './commands/test';
import { validateNode } from './commands/validate';
import { publishNode } from './commands/publish';
import { initProject } from './commands/init';

const program = new Command();

// CLI version and description
program
  .name('n8n-work')
  .description('N8N-Work Node SDK CLI for creating and managing custom nodes')
  .version('1.0.0');

// Global options
program
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--no-color', 'Disable colored output');

// Initialize a new node project
program
  .command('init')
  .description('Initialize a new N8N-Work node project')
  .argument('[name]', 'Project name')
  .option('-t, --template <template>', 'Project template (basic, http, trigger)', 'basic')
  .option('-d, --dir <directory>', 'Target directory')
  .option('--skip-install', 'Skip npm install')
  .action(async (name, options) => {
    try {
      await initProject(name, options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Create a new node
program
  .command('create')
  .description('Create a new node')
  .argument('<name>', 'Node name')
  .option('-t, --type <type>', 'Node type (action, trigger, webhook)', 'action')
  .option('-d, --description <description>', 'Node description')
  .option('--output <path>', 'Output directory', './src/nodes')
  .action(async (name, options) => {
    try {
      await createNode(name, options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Build nodes
program
  .command('build')
  .description('Build and compile nodes')
  .option('-w, --watch', 'Watch for changes')
  .option('-o, --output <path>', 'Output directory', './dist')
  .option('--minify', 'Minify output')
  .action(async (options) => {
    try {
      await buildNode(options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Test nodes
program
  .command('test')
  .description('Test nodes')
  .argument('[pattern]', 'Test file pattern', '**/*.test.ts')
  .option('-w, --watch', 'Watch for changes')
  .option('--coverage', 'Generate coverage report')
  .action(async (pattern, options) => {
    try {
      await testNode(pattern, options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Validate nodes
program
  .command('validate')
  .description('Validate node definitions and implementations')
  .argument('[files...]', 'Node files to validate')
  .option('--strict', 'Enable strict validation')
  .action(async (files, options) => {
    try {
      await validateNode(files, options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Publish nodes
program
  .command('publish')
  .description('Publish nodes to registry')
  .option('--registry <url>', 'Registry URL')
  .option('--tag <tag>', 'Publishing tag', 'latest')
  .option('--dry-run', 'Perform a dry run without publishing')
  .action(async (options) => {
    try {
      await publishNode(options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Dev server for testing nodes
program
  .command('dev')
  .description('Start development server for testing nodes')
  .option('-p, --port <port>', 'Server port', '3000')
  .option('--host <host>', 'Server host', 'localhost')
  .action(async (options) => {
    try {
      const { startDevServer } = await import('./commands/dev');
      await startDevServer(options);
    } catch (error) {
      console.error(chalk.red('Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red('Invalid command:'), chalk.yellow(program.args.join(' ')));
  console.log('See --help for a list of available commands.');
  process.exit(1);
});

// Handle no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
  process.exit(0);
}

// Parse command line arguments
program.parse();

// Handle global options
const options = program.opts();

if (options.verbose) {
  process.env.VERBOSE = 'true';
}

if (options.noColor) {
  process.env.NO_COLOR = 'true';
}
