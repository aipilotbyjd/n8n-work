import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import Mustache from 'mustache';
import { sanitizeFileName } from '@/utils';

interface InitOptions {
  template: 'basic' | 'http' | 'trigger';
  dir?: string;
  skipInstall: boolean;
}

const projectTemplates = {
  basic: {
    description: 'Basic node project with simple action node',
    dependencies: {
      '@n8n-work/node-sdk': '^1.0.0',
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      'typescript': '^5.0.0',
      'jest': '^29.0.0',
      '@types/jest': '^29.0.0',
      'ts-jest': '^29.0.0',
    },
  },
  http: {
    description: 'HTTP-based node project with API integration',
    dependencies: {
      '@n8n-work/node-sdk': '^1.0.0',
      'axios': '^1.6.0',
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      'typescript': '^5.0.0',
      'jest': '^29.0.0',
      '@types/jest': '^29.0.0',
      'ts-jest': '^29.0.0',
      'nock': '^13.0.0',
    },
  },
  trigger: {
    description: 'Trigger node project with polling and webhook support',
    dependencies: {
      '@n8n-work/node-sdk': '^1.0.0',
      'cron': '^3.0.0',
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      'typescript': '^5.0.0',
      'jest': '^29.0.0',
      '@types/jest': '^29.0.0',
      'ts-jest': '^29.0.0',
      '@types/cron': '^2.0.0',
    },
  },
};

const packageJsonTemplate = `{
  "name": "{{projectName}}",
  "version": "1.0.0",
  "description": "{{description}}",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "dev": "n8n-work dev",
    "validate": "n8n-work validate",
    "clean": "rimraf dist"
  },
  "keywords": [
    "n8n-work",
    "node",
    "automation",
    "workflow"
  ],
  "author": "{{author}}",
  "license": "MIT",
  "dependencies": {
    {{#dependencies}}
    "{{name}}": "{{version}}"{{#hasNext}},{{/hasNext}}
    {{/dependencies}}
  },
  "devDependencies": {
    {{#devDependencies}}
    "{{name}}": "{{version}}"{{#hasNext}},{{/hasNext}}
    {{/devDependencies}}
  },
  "engines": {
    "node": ">=16.0.0"
  }
}`;

const tsconfigTemplate = `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts"
  ]
}`;

const jestConfigTemplate = `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts'],
  transform: {
    '^.+\\\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};`;

const readmeTemplate = `# {{displayName}}

{{description}}

## Installation

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
# Build the project
npm run build

# Run tests
npm run test

# Watch for changes
npm run build:watch
npm run test:watch

# Start development server
npm run dev
\`\`\`

## Usage

This project contains N8N-Work nodes that can be used in workflows.

### Available Nodes

- **{{displayName}}**: {{description}}

## Testing

Run the test suite:

\`\`\`bash
npm test
\`\`\`

Generate coverage report:

\`\`\`bash
npm run test:coverage
\`\`\`

## Building

Build the project for distribution:

\`\`\`bash
npm run build
\`\`\`

## Validation

Validate your nodes:

\`\`\`bash
npm run validate
\`\`\`

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
`;

const gitignoreTemplate = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Build output
dist/
build/

# Coverage reports
coverage/
*.lcov

# Environment variables
.env
.env.local
.env.*.local

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Jest cache
.jest/

# TypeScript cache
*.tsbuildinfo
`;

export async function initProject(name?: string, options?: InitOptions): Promise<void> {
  let projectName = name;
  let template = options?.template || 'basic';
  let targetDir = options?.dir;

  // Interactive prompts if name not provided
  if (!projectName) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Project name:',
        validate: (input: string) => {
          if (!input || !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(input)) {
            return 'Project name must start with a letter and contain only letters, numbers, and hyphens';
          }
          return true;
        },
      },
      {
        type: 'list',
        name: 'template',
        message: 'Project template:',
        choices: [
          { name: 'Basic - Simple action node', value: 'basic' },
          { name: 'HTTP - API integration nodes', value: 'http' },
          { name: 'Trigger - Polling and webhook nodes', value: 'trigger' },
        ],
        default: template,
      },
      {
        type: 'input',
        name: 'author',
        message: 'Author name:',
        default: process.env.USER || process.env.USERNAME || 'Unknown',
      },
    ]);

    projectName = answers.name;
    template = answers.template;
  }

  if (!targetDir) {
    targetDir = path.join(process.cwd(), projectName!);
  }

  const spinner = ora('Initializing project...').start();

  try {
    // Validate project name
    if (!projectName || !/^[a-zA-Z][a-zA-Z0-9-]*$/.test(projectName)) {
      throw new Error('Project name must start with a letter and contain only letters, numbers, and hyphens');
    }

    // Check if directory already exists
    try {
      await fs.access(targetDir);
      throw new Error(`Directory already exists: ${targetDir}`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Create project directory
    await fs.mkdir(targetDir, { recursive: true });

    const templateConfig = projectTemplates[template as keyof typeof projectTemplates];
    const displayName = projectName
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

    // Prepare template data
    const templateData = {
      projectName,
      displayName,
      description: templateConfig.description,
      author: process.env.USER || process.env.USERNAME || 'Unknown',
      dependencies: Object.entries(templateConfig.dependencies).map(([name, version], index, array) => ({
        name,
        version,
        hasNext: index < array.length - 1,
      })),
      devDependencies: Object.entries(templateConfig.devDependencies).map(([name, version], index, array) => ({
        name,
        version,
        hasNext: index < array.length - 1,
      })),
    };

    // Create package.json
    const packageJson = Mustache.render(packageJsonTemplate, templateData);
    await fs.writeFile(path.join(targetDir, 'package.json'), packageJson, 'utf8');

    // Create tsconfig.json
    await fs.writeFile(path.join(targetDir, 'tsconfig.json'), tsconfigTemplate, 'utf8');

    // Create jest.config.js
    await fs.writeFile(path.join(targetDir, 'jest.config.js'), jestConfigTemplate, 'utf8');

    // Create README.md
    const readme = Mustache.render(readmeTemplate, templateData);
    await fs.writeFile(path.join(targetDir, 'README.md'), readme, 'utf8');

    // Create .gitignore
    await fs.writeFile(path.join(targetDir, '.gitignore'), gitignoreTemplate, 'utf8');

    // Create src directory structure
    const srcDir = path.join(targetDir, 'src');
    await fs.mkdir(srcDir, { recursive: true });
    await fs.mkdir(path.join(srcDir, 'nodes'), { recursive: true });

    // Create index.ts
    const indexContent = `// Export your nodes here
export * from './nodes';
`;
    await fs.writeFile(path.join(srcDir, 'index.ts'), indexContent, 'utf8');

    // Create nodes/index.ts
    const nodesIndexContent = `// Export all your nodes here
// Example: export { MyNode } from './my-node';
`;
    await fs.writeFile(path.join(srcDir, 'nodes', 'index.ts'), nodesIndexContent, 'utf8');

    spinner.succeed('Project initialized successfully!');

    console.log(chalk.green('\\n✓ Created project:'), chalk.cyan(projectName));
    console.log(chalk.gray(`  Location: ${targetDir}`));
    console.log(chalk.gray(`  Template: ${template}`));

    if (!options?.skipInstall) {
      const installSpinner = ora('Installing dependencies...').start();
      try {
        process.chdir(targetDir);
        execSync('npm install', { stdio: 'pipe' });
        installSpinner.succeed('Dependencies installed successfully!');
      } catch (error) {
        installSpinner.fail('Failed to install dependencies');
        console.log(chalk.yellow('\\n⚠️  You can install dependencies manually with: npm install'));
      }
    }

    console.log(chalk.blue('\\n📖 Next steps:'));
    console.log(`  cd ${projectName}`);
    if (options?.skipInstall) {
      console.log('  npm install');
    }
    console.log('  n8n-work create <node-name>  # Create your first node');
    console.log('  npm run build               # Build the project');
    console.log('  npm test                    # Run tests');
    console.log('  npm run dev                 # Start development server');

  } catch (error) {
    spinner.fail('Failed to initialize project');
    throw error;
  }
}
