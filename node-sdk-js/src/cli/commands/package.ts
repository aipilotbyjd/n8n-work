/**
 * Package command - Package nodes for distribution
 */

import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { glob } from 'glob';
import archiver from 'archiver';
import { buildNodeCommand } from './build';

export interface PackageOptions {
  output: string;
  format: 'npm' | 'zip';
  include?: string[];
  exclude?: string[];
}

/**
 * Package nodes for distribution
 */
export async function packageNodeCommand(
  pattern: string = '**/*.node.ts',
  options: PackageOptions
): Promise<void> {
  const spinner = ora('Packaging nodes...').start();

  try {
    // Ensure output directory exists
    await fs.mkdir(options.output, { recursive: true });

    // First, build the nodes
    spinner.text = 'Building nodes...';
    await buildNodeCommand(pattern, {
      output: options.output,
      watch: false,
      minify: true,
      sourcemap: false,
    });

    // Find all built node files
    const nodeFiles = await glob('**/*.node.js', {
      cwd: options.output,
      absolute: true,
    });

    if (nodeFiles.length === 0) {
      throw new Error('No built node files found');
    }

    spinner.text = 'Creating package...';

    if (options.format === 'npm') {
      await createNpmPackage(nodeFiles, options);
    } else {
      await createZipPackage(nodeFiles, options);
    }

    spinner.succeed(
      chalk.green(`Successfully packaged ${nodeFiles.length} node(s) to ${options.output}`)
    );
  } catch (error) {
    spinner.fail(chalk.red('Packaging failed'));
    throw error;
  }
}

/**
 * Create NPM package structure
 */
async function createNpmPackage(nodeFiles: string[], options: PackageOptions): Promise<void> {
  const packageInfo = await generatePackageJson(nodeFiles);
  
  // Write package.json
  const packageJsonPath = path.join(options.output, 'package.json');
  await fs.writeFile(packageJsonPath, JSON.stringify(packageInfo, null, 2));

  // Create README.md if it doesn't exist
  const readmePath = path.join(options.output, 'README.md');
  try {
    await fs.access(readmePath);
  } catch {
    await fs.writeFile(readmePath, generateReadme(packageInfo));
  }

  // Copy additional files if specified
  if (options.include) {
    for (const pattern of options.include) {
      const files = await glob(pattern, { absolute: true });
      for (const file of files) {
        const relativePath = path.relative(process.cwd(), file);
        const targetPath = path.join(options.output, relativePath);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.copyFile(file, targetPath);
      }
    }
  }
}

/**
 * Create ZIP package
 */
async function createZipPackage(nodeFiles: string[], options: PackageOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const zipPath = path.join(options.output, 'nodes.zip');
    const output = require('fs').createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', reject);

    archive.pipe(output);

    // Add node files
    for (const nodeFile of nodeFiles) {
      const relativePath = path.relative(options.output, nodeFile);
      archive.file(nodeFile, { name: relativePath });
    }

    // Add additional files if specified
    if (options.include) {
      for (const pattern of options.include) {
        archive.glob(pattern);
      }
    }

    archive.finalize();
  });
}

/**
 * Generate package.json for nodes
 */
async function generatePackageJson(nodeFiles: string[]): Promise<any> {
  // Try to read existing package.json
  let existingPackage: any = {};
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
    existingPackage = JSON.parse(packageContent);
  } catch {
    // No existing package.json
  }

  // Extract node information
  const nodes: string[] = [];
  const credentials: string[] = [];

  for (const nodeFile of nodeFiles) {
    const relativePath = path.relative(process.cwd(), nodeFile);
    nodes.push(relativePath);

    // Look for corresponding credential files
    const credentialFile = nodeFile.replace('.node.js', '.credentials.js');
    try {
      await fs.access(credentialFile);
      credentials.push(path.relative(process.cwd(), credentialFile));
    } catch {
      // No credential file
    }
  }

  return {
    name: existingPackage.name || '@my-company/n8n-nodes',
    version: existingPackage.version || '1.0.0',
    description: existingPackage.description || 'Custom nodes for N8N-Work',
    keywords: [
      'n8n-work',
      'workflow',
      'automation',
      'nodes',
      ...(existingPackage.keywords || []),
    ],
    license: existingPackage.license || 'MIT',
    author: existingPackage.author || '',
    main: 'index.js',
    files: ['dist/**/*', 'README.md'],
    n8n: {
      n8nNodesApiVersion: 1,
      credentials: credentials,
      nodes: nodes,
    },
    peerDependencies: {
      '@n8n-work/node-sdk': '^1.0.0',
    },
    ...existingPackage,
  };
}

/**
 * Generate README.md content
 */
function generateReadme(packageInfo: any): string {
  return `# ${packageInfo.name}

${packageInfo.description}

## Installation

\`\`\`bash
npm install ${packageInfo.name}
\`\`\`

## Nodes

This package contains the following nodes:

${packageInfo.n8n.nodes.map((node: string) => `- ${path.basename(node, '.js')}`).join('\n')}

## Usage

After installation, the nodes will be automatically available in your N8N-Work instance.

## License

${packageInfo.license}
`;
}
