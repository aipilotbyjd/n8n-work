#!/usr/bin/env node

/**
 * N8N-Work Project Structure Validator
 * 
 * This script validates the complete project structure and ensures
 * all required files and configurations are present and properly organized.
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class StructureValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.success = [];
        this.projectRoot = process.cwd();
    }

    // Main validation entry point
    async validate() {
        console.log(chalk.blue.bold('🔍 N8N-Work Project Structure Validation\n'));
        
        this.validateRootStructure();
        this.validateMicroservices();
        this.validateInfrastructure();
        this.validateDocumentation();
        this.validateScripts();
        this.validateProtocolBuffers();
        
        this.printResults();
        return this.errors.length === 0;
    }

    // Validate root project structure
    validateRootStructure() {
        const requiredFiles = [
            'README.md',
            'docker-compose.yml',
            'Makefile',
            '.gitignore',
            '.env'
        ];

        const requiredDirs = [
            'orchestrator-nest',
            'engine-go',
            'node-runner-js',
            'node-sdk-js',
            'proto-contracts',
            'infra',
            'docs',
            'tests',
            'scripts'
        ];

        this.checkFiles('Root Files', requiredFiles);
        this.checkDirectories('Root Directories', requiredDirs);
    }

    // Validate each microservice structure
    validateMicroservices() {
        const services = [
            {
                name: 'orchestrator-nest',
                type: 'typescript',
                requiredFiles: ['package.json', 'tsconfig.json', 'Dockerfile', 'nest-cli.json'],
                requiredDirs: ['src', 'dist']
            },
            {
                name: 'engine-go',
                type: 'go',
                requiredFiles: ['go.mod', 'go.sum', 'Dockerfile'],
                requiredDirs: ['cmd', 'internal']
            },
            {
                name: 'node-runner-js',
                type: 'typescript',
                requiredFiles: ['package.json', 'tsconfig.json', 'Dockerfile'],
                requiredDirs: ['src', 'dist']
            },
            {
                name: 'node-sdk-js',
                type: 'typescript',
                requiredFiles: ['package.json', 'tsconfig.json'],
                requiredDirs: ['src']
            }
        ];

        services.forEach(service => {
            this.validateService(service);
        });
    }

    // Validate individual service
    validateService(service) {
        const servicePath = path.join(this.projectRoot, service.name);
        
        if (!fs.existsSync(servicePath)) {
            this.addError(`Service directory missing: ${service.name}`);
            return;
        }

        // Check required files
        service.requiredFiles.forEach(file => {
            const filePath = path.join(servicePath, file);
            if (fs.existsSync(filePath)) {
                this.addSuccess(`${service.name}/${file} exists`);
            } else {
                this.addError(`Missing file: ${service.name}/${file}`);
            }
        });

        // Check required directories
        service.requiredDirs.forEach(dir => {
            const dirPath = path.join(servicePath, dir);
            if (fs.existsSync(dirPath)) {
                this.addSuccess(`${service.name}/${dir}/ exists`);
            } else {
                this.addError(`Missing directory: ${service.name}/${dir}/`);
            }
        });

        // Service-specific validations
        this.validateServiceSpecific(service, servicePath);
    }

    // Service-specific validations
    validateServiceSpecific(service, servicePath) {
        if (service.type === 'typescript') {
            this.validateTypeScriptService(service, servicePath);
        } else if (service.type === 'go') {
            this.validateGoService(service, servicePath);
        }
    }

    // Validate TypeScript service structure
    validateTypeScriptService(service, servicePath) {
        const packageJsonPath = path.join(servicePath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                
                // Check essential scripts
                const requiredScripts = ['build', 'start', 'test', 'lint'];
                const missingScripts = requiredScripts.filter(script => !packageJson.scripts?.[script]);
                
                if (missingScripts.length === 0) {
                    this.addSuccess(`${service.name} has all required npm scripts`);
                } else {
                    this.addWarning(`${service.name} missing scripts: ${missingScripts.join(', ')}`);
                }

                // Check dependencies
                if (packageJson.dependencies) {
                    this.addSuccess(`${service.name} has dependencies configured`);
                } else {
                    this.addWarning(`${service.name} has no dependencies`);
                }
            } catch (error) {
                this.addError(`Invalid package.json in ${service.name}: ${error.message}`);
            }
        }
    }

    // Validate Go service structure
    validateGoService(service, servicePath) {
        const goModPath = path.join(servicePath, 'go.mod');
        if (fs.existsSync(goModPath)) {
            try {
                const goModContent = fs.readFileSync(goModPath, 'utf8');
                if (goModContent.includes('module github.com/n8n-work/engine-go')) {
                    this.addSuccess(`${service.name} has correct module path`);
                } else {
                    this.addWarning(`${service.name} module path may be incorrect`);
                }
            } catch (error) {
                this.addError(`Cannot read go.mod in ${service.name}: ${error.message}`);
            }
        }
    }

    // Validate infrastructure structure
    validateInfrastructure() {
        const infraPath = path.join(this.projectRoot, 'infra');
        
        const requiredInfraFiles = [
            'docker-compose.yml'
        ];

        const requiredInfraDirs = [
            'k8s',
            'grafana',
            'prometheus',
            'postgres'
        ];

        requiredInfraFiles.forEach(file => {
            const filePath = path.join(infraPath, file);
            if (fs.existsSync(filePath)) {
                this.addSuccess(`infra/${file} exists`);
            } else {
                this.addError(`Missing infrastructure file: infra/${file}`);
            }
        });

        requiredInfraDirs.forEach(dir => {
            const dirPath = path.join(infraPath, dir);
            if (fs.existsSync(dirPath)) {
                this.addSuccess(`infra/${dir}/ exists`);
            } else {
                this.addWarning(`Missing infrastructure directory: infra/${dir}/`);
            }
        });

        // Validate Kubernetes charts
        this.validateKubernetesCharts();
    }

    // Validate Kubernetes charts structure
    validateKubernetesCharts() {
        const chartsPath = path.join(this.projectRoot, 'infra', 'k8s', 'charts');
        
        if (!fs.existsSync(chartsPath)) {
            this.addError('Missing Kubernetes charts directory');
            return;
        }

        const requiredCharts = ['n8n-work', 'orchestrator', 'engine-go', 'node-runner-js', 'observability'];
        
        requiredCharts.forEach(chart => {
            const chartPath = path.join(chartsPath, chart);
            if (fs.existsSync(chartPath)) {
                this.validateHelmChart(chart, chartPath);
            } else {
                this.addError(`Missing Helm chart: ${chart}`);
            }
        });
    }

    // Validate individual Helm chart
    validateHelmChart(chartName, chartPath) {
        const requiredFiles = ['Chart.yaml'];
        const requiredDirs = ['templates'];
        
        // For main chart, also check for values files
        if (chartName === 'n8n-work') {
            requiredFiles.push('values.yaml', 'values-dev.yaml', 'values-staging.yaml', 'values-prod.yaml');
        } else {
            requiredFiles.push('values.yaml');
        }

        requiredFiles.forEach(file => {
            const filePath = path.join(chartPath, file);
            if (fs.existsSync(filePath)) {
                this.addSuccess(`Helm chart ${chartName}/${file} exists`);
            } else {
                this.addError(`Missing Helm chart file: ${chartName}/${file}`);
            }
        });

        requiredDirs.forEach(dir => {
            const dirPath = path.join(chartPath, dir);
            if (fs.existsSync(dirPath)) {
                this.addSuccess(`Helm chart ${chartName}/${dir}/ exists`);
            } else {
                this.addError(`Missing Helm chart directory: ${chartName}/${dir}/`);
            }
        });
    }

    // Validate documentation
    validateDocumentation() {
        const docsPath = path.join(this.projectRoot, 'docs');
        
        const requiredDocs = [
            'index.md',
            'api',
            'architecture',
            'guide'
        ];

        requiredDocs.forEach(doc => {
            const docPath = path.join(docsPath, doc);
            if (fs.existsSync(docPath)) {
                this.addSuccess(`Documentation ${doc} exists`);
            } else {
                this.addWarning(`Missing documentation: docs/${doc}`);
            }
        });
    }

    // Validate scripts
    validateScripts() {
        const scriptsPath = path.join(this.projectRoot, 'scripts');
        
        if (fs.existsSync(scriptsPath)) {
            this.addSuccess('Scripts directory exists');
        } else {
            this.addWarning('Missing scripts directory');
        }
    }

    // Validate protocol buffers
    validateProtocolBuffers() {
        const protoPath = path.join(this.projectRoot, 'proto-contracts');
        
        const requiredProtos = [
            'engine.proto',
            'orchestrator.proto',
            'node_runner.proto',
            'workflow.proto',
            'execution.proto'
        ];

        requiredProtos.forEach(proto => {
            const protoFile = path.join(protoPath, proto);
            if (fs.existsSync(protoFile)) {
                this.addSuccess(`Protocol buffer ${proto} exists`);
            } else {
                this.addError(`Missing protocol buffer: ${proto}`);
            }
        });

        // Check for generation scripts
        const generateScript = path.join(protoPath, 'generate.sh');
        const generateScriptPs = path.join(protoPath, 'generate.ps1');
        
        if (fs.existsSync(generateScript) || fs.existsSync(generateScriptPs)) {
            this.addSuccess('Protocol buffer generation scripts exist');
        } else {
            this.addWarning('Missing protocol buffer generation scripts');
        }
    }

    // Helper methods
    checkFiles(category, files) {
        files.forEach(file => {
            const filePath = path.join(this.projectRoot, file);
            if (fs.existsSync(filePath)) {
                this.addSuccess(`${file} exists`);
            } else {
                this.addError(`Missing file: ${file}`);
            }
        });
    }

    checkDirectories(category, dirs) {
        dirs.forEach(dir => {
            const dirPath = path.join(this.projectRoot, dir);
            if (fs.existsSync(dirPath)) {
                this.addSuccess(`${dir}/ exists`);
            } else {
                this.addError(`Missing directory: ${dir}/`);
            }
        });
    }

    addError(message) {
        this.errors.push(message);
    }

    addWarning(message) {
        this.warnings.push(message);
    }

    addSuccess(message) {
        this.success.push(message);
    }

    // Print validation results
    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log(chalk.blue.bold('📊 VALIDATION RESULTS'));
        console.log('='.repeat(60));

        if (this.success.length > 0) {
            console.log(chalk.green.bold(`\n✅ SUCCESS (${this.success.length})`));
            // Only show first few successes to avoid clutter
            this.success.slice(0, 5).forEach(msg => {
                console.log(chalk.green(`  ✓ ${msg}`));
            });
            if (this.success.length > 5) {
                console.log(chalk.green(`  ... and ${this.success.length - 5} more`));
            }
        }

        if (this.warnings.length > 0) {
            console.log(chalk.yellow.bold(`\n⚠️  WARNINGS (${this.warnings.length})`));
            this.warnings.forEach(msg => {
                console.log(chalk.yellow(`  ⚠ ${msg}`));
            });
        }

        if (this.errors.length > 0) {
            console.log(chalk.red.bold(`\n❌ ERRORS (${this.errors.length})`));
            this.errors.forEach(msg => {
                console.log(chalk.red(`  ✗ ${msg}`));
            });
        }

        console.log('\n' + '='.repeat(60));
        
        if (this.errors.length === 0) {
            console.log(chalk.green.bold('🎉 PROJECT STRUCTURE IS VALID!'));
            console.log(chalk.green('Your N8N-Work project is properly structured and ready for production.'));
        } else {
            console.log(chalk.red.bold('❌ PROJECT STRUCTURE HAS ISSUES'));
            console.log(chalk.red(`Please fix ${this.errors.length} error(s) before proceeding.`));
        }
        
        console.log('='.repeat(60) + '\n');
    }
}

// Run validation if called directly
if (require.main === module) {
    const validator = new StructureValidator();
    validator.validate().then(isValid => {
        process.exit(isValid ? 0 : 1);
    }).catch(error => {
        console.error(chalk.red('Validation failed:'), error.message);
        process.exit(1);
    });
}

module.exports = StructureValidator;