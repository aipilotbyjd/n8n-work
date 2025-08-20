import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

interface BuildOptions {
  watch: boolean;
  output: string;
  minify: boolean;
}

export async function buildNode(options: BuildOptions): Promise<void> {
  const spinner = ora('Building nodes...').start();

  try {
    let command = 'tsc';
    
    if (options.watch) {
      command += ' --watch';
    }

    if (options.output !== './dist') {
      command += ` --outDir ${options.output}`;
    }

    execSync(command, { stdio: 'inherit' });
    
    if (!options.watch) {
      spinner.succeed('Build completed successfully!');
    }
  } catch (error) {
    spinner.fail('Build failed');
    throw error;
  }
}
