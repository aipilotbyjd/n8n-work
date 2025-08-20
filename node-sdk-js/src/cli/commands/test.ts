import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

interface TestOptions {
  watch: boolean;
  coverage: boolean;
}

export async function testNode(pattern: string, options: TestOptions): Promise<void> {
  const spinner = ora('Running tests...').start();

  try {
    let command = 'jest';
    
    if (pattern !== '**/*.test.ts') {
      command += ` "${pattern}"`;
    }

    if (options.watch) {
      command += ' --watch';
    }

    if (options.coverage) {
      command += ' --coverage';
    }

    execSync(command, { stdio: 'inherit' });
    
    if (!options.watch) {
      spinner.succeed('Tests completed successfully!');
    }
  } catch (error) {
    spinner.fail('Tests failed');
    throw error;
  }
}
