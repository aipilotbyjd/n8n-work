import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { glob } from 'glob';

interface ValidateOptions {
  strict: boolean;
}

export async function validateNode(files: string[], options: ValidateOptions): Promise<void> {
  const spinner = ora('Validating nodes...').start();

  try {
    let nodeFiles: string[] = [];

    if (files.length === 0) {
      // Auto-discover node files
      nodeFiles = await glob('src/**/*.ts', { ignore: ['**/*.test.ts', '**/*.spec.ts'] });
    } else {
      nodeFiles = files;
    }

    if (nodeFiles.length === 0) {
      spinner.warn('No node files found to validate');
      return;
    }

    const validationResults = await Promise.all(
      nodeFiles.map(async (file) => validateSingleNode(file, options))
    );

    const totalErrors = validationResults.reduce((sum, result) => sum + result.errors, 0);
    const totalWarnings = validationResults.reduce((sum, result) => sum + result.warnings, 0);

    if (totalErrors === 0) {
      spinner.succeed(`Validation completed: ${nodeFiles.length} files validated`);
      
      if (totalWarnings > 0) {
        console.log(chalk.yellow(`\\n⚠️  ${totalWarnings} warnings found`));
      }
      
      console.log(chalk.green('\\n✓ All nodes are valid!'));
    } else {
      spinner.fail(`Validation failed: ${totalErrors} errors, ${totalWarnings} warnings`);
      
      // Print detailed results
      for (const result of validationResults) {
        if (result.errors > 0 || result.warnings > 0) {
          console.log(chalk.red(`\\n❌ ${result.file}:`));
          result.issues.forEach(issue => {
            const icon = issue.type === 'error' ? '❌' : '⚠️';
            const color = issue.type === 'error' ? chalk.red : chalk.yellow;
            console.log(color(`  ${icon} ${issue.message}`));
          });
        }
      }
      
      process.exit(1);
    }

  } catch (error) {
    spinner.fail('Validation failed');
    throw error;
  }
}

interface ValidationIssue {
  type: 'error' | 'warning';
  message: string;
}

interface ValidationResult {
  file: string;
  errors: number;
  warnings: number;
  issues: ValidationIssue[];
}

async function validateSingleNode(filePath: string, options: ValidateOptions): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Basic syntax validation
    if (!content.includes('extends NodeBase') && 
        !content.includes('extends HttpRequestNode') && 
        !content.includes('extends TriggerNode')) {
      issues.push({
        type: 'error',
        message: 'Node class must extend NodeBase, HttpRequestNode, or TriggerNode'
      });
    }

    // Check for nodeType property
    if (!content.includes('nodeType: INodeType')) {
      issues.push({
        type: 'error',
        message: 'Node must have a nodeType property of type INodeType'
      });
    }

    // Check for execute method (unless it's a trigger node)
    if (!content.includes('extends TriggerNode') && !content.includes('async execute(')) {
      issues.push({
        type: 'error',
        message: 'Action nodes must implement the execute method'
      });
    }

    // Check for required imports
    const requiredImports = ['INodeType', 'IExecutionContext', 'IWorkflowData', 'INodeExecutionData'];
    for (const importName of requiredImports) {
      if (!content.includes(importName)) {
        issues.push({
          type: 'warning',
          message: `Missing recommended import: ${importName}`
        });
      }
    }

    // Strict mode checks
    if (options.strict) {
      // Check for proper TypeScript typing
      if (content.includes(': any')) {
        issues.push({
          type: 'warning',
          message: 'Avoid using "any" type in strict mode'
        });
      }

      // Check for proper error handling
      if (!content.includes('try') && !content.includes('catch')) {
        issues.push({
          type: 'warning',
          message: 'Consider adding error handling with try-catch blocks'
        });
      }

      // Check for parameter validation
      if (!content.includes('validateRequiredParameters')) {
        issues.push({
          type: 'warning',
          message: 'Consider validating required parameters'
        });
      }
    }

  } catch (error) {
    issues.push({
      type: 'error',
      message: `Failed to read file: ${(error as Error).message}`
    });
  }

  return {
    file: filePath,
    errors: issues.filter(i => i.type === 'error').length,
    warnings: issues.filter(i => i.type === 'warning').length,
    issues
  };
}
