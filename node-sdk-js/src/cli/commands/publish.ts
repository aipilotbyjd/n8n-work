import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

interface PublishOptions {
  registry?: string;
  tag: string;
  dryRun: boolean;
}

export async function publishNode(options: PublishOptions): Promise<void> {
  const spinner = ora('Publishing node...').start();

  try {
    let command = 'npm publish';
    
    if (options.registry) {
      command += ` --registry ${options.registry}`;
    }

    if (options.tag !== 'latest') {
      command += ` --tag ${options.tag}`;
    }

    if (options.dryRun) {
      command += ' --dry-run';
    }

    execSync(command, { stdio: 'inherit' });
    
    if (options.dryRun) {
      spinner.succeed('Dry run completed successfully!');
    } else {
      spinner.succeed('Node published successfully!');
    }
  } catch (error) {
    spinner.fail('Publishing failed');
    throw error;
  }
}
