#!/usr/bin/env node

/**
 * N8N-Work Project Health Check
 * 
 * Comprehensive health check for all services and infrastructure components
 */

const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

class HealthChecker {
    constructor() {
        this.results = [];
        this.services = [
            { name: 'Orchestrator', url: 'http://localhost:3000/health', type: 'http' },
            { name: 'Engine-Go', url: 'http://localhost:8080/health', type: 'http' },
            { name: 'Node-Runner', url: 'http://localhost:3002/health', type: 'http' },
            { name: 'PostgreSQL', url: 'postgresql://localhost:5432', type: 'db' },
            { name: 'Redis', url: 'redis://localhost:6379', type: 'cache' },
            { name: 'RabbitMQ', url: 'http://localhost:15672/api/overview', type: 'mq' },
            { name: 'Grafana', url: 'http://localhost:3001/api/health', type: 'monitoring' },
            { name: 'Prometheus', url: 'http://localhost:9090/-/healthy', type: 'monitoring' },
            { name: 'Jaeger', url: 'http://localhost:16686', type: 'tracing' }
        ];
    }

    async checkHealth() {
        console.log(chalk.blue.bold('🏥 N8N-Work Health Check\n'));
        
        console.log(chalk.gray('Checking service health...'));
        await this.checkServices();
        
        console.log(chalk.gray('Checking project structure...'));
        await this.checkProjectStructure();
        
        console.log(chalk.gray('Checking dependencies...'));
        await this.checkDependencies();
        
        this.printResults();
        return this.getOverallHealth();
    }

    async checkServices() {
        for (const service of this.services) {
            try {
                const result = await this.checkService(service);
                this.results.push(result);
            } catch (error) {
                this.results.push({
                    name: service.name,
                    status: 'error',
                    message: error.message,
                    type: service.type
                });
            }
        }
    }

    async checkService(service) {
        const timeout = 5000; // 5 seconds
        
        try {
            if (service.type === 'http') {
                const response = await axios.get(service.url, { 
                    timeout,
                    validateStatus: (status) => status < 500 
                });
                
                return {
                    name: service.name,
                    status: response.status < 400 ? 'healthy' : 'warning',
                    message: `HTTP ${response.status}`,
                    type: service.type,
                    responseTime: response.config?.responseTime || 'N/A'
                };
            } else if (service.type === 'mq') {
                // RabbitMQ specific check
                const response = await axios.get(service.url, { 
                    timeout,
                    auth: {
                        username: 'n8n_work',
                        password: 'n8n_work_dev'
                    }
                });
                
                return {
                    name: service.name,
                    status: 'healthy',
                    message: 'Management API accessible',
                    type: service.type
                };
            } else {
                // For database and cache, just check if port is accessible
                return await this.checkPort(service);
            }
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                return {
                    name: service.name,
                    status: 'down',
                    message: 'Connection refused - service not running',
                    type: service.type
                };
            } else if (error.code === 'ETIMEDOUT') {
                return {
                    name: service.name,
                    status: 'timeout',
                    message: 'Service timeout',
                    type: service.type
                };
            } else {
                return {
                    name: service.name,
                    status: 'error',
                    message: error.message,
                    type: service.type
                };
            }
        }
    }

    async checkPort(service) {
        const net = require('net');
        const url = new URL(service.url);
        const host = url.hostname;
        const port = parseInt(url.port) || (url.protocol === 'postgresql:' ? 5432 : 6379);

        return new Promise((resolve) => {
            const socket = new net.Socket();
            const timeout = 3000;

            socket.setTimeout(timeout);
            socket.on('connect', () => {
                socket.destroy();
                resolve({
                    name: service.name,
                    status: 'healthy',
                    message: `Port ${port} accessible`,
                    type: service.type
                });
            });

            socket.on('timeout', () => {
                socket.destroy();
                resolve({
                    name: service.name,
                    status: 'timeout',
                    message: `Port ${port} timeout`,
                    type: service.type
                });
            });

            socket.on('error', (error) => {
                socket.destroy();
                resolve({
                    name: service.name,
                    status: 'down',
                    message: `Port ${port} not accessible`,
                    type: service.type
                });
            });

            socket.connect(port, host);
        });
    }

    async checkProjectStructure() {
        const StructureValidator = require('./validate-structure');
        const validator = new StructureValidator();
        
        // Simulate validation without printing
        const originalLog = console.log;
        console.log = () => {}; // Suppress output
        
        try {
            const isValid = await validator.validate();
            console.log = originalLog; // Restore logging
            
            this.results.push({
                name: 'Project Structure',
                status: isValid ? 'healthy' : 'warning',
                message: isValid ? 'All required files and directories present' : 'Some structural issues found',
                type: 'structure'
            });
        } catch (error) {
            console.log = originalLog;
            this.results.push({
                name: 'Project Structure',
                status: 'error',
                message: `Validation failed: ${error.message}`,
                type: 'structure'
            });
        }
    }

    async checkDependencies() {
        const services = [
            { name: 'Orchestrator Dependencies', path: 'orchestrator-nest/package.json' },
            { name: 'Node-Runner Dependencies', path: 'node-runner-js/package.json' },
            { name: 'Node-SDK Dependencies', path: 'node-sdk-js/package.json' },
            { name: 'Engine-Go Dependencies', path: 'engine-go/go.mod' }
        ];

        for (const service of services) {
            try {
                const filePath = path.join(process.cwd(), service.path);
                if (fs.existsSync(filePath)) {
                    this.results.push({
                        name: service.name,
                        status: 'healthy',
                        message: 'Dependencies file exists',
                        type: 'dependencies'
                    });
                } else {
                    this.results.push({
                        name: service.name,
                        status: 'error',
                        message: 'Dependencies file missing',
                        type: 'dependencies'
                    });
                }
            } catch (error) {
                this.results.push({
                    name: service.name,
                    status: 'error',
                    message: error.message,
                    type: 'dependencies'
                });
            }
        }
    }

    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log(chalk.blue.bold('📊 HEALTH CHECK RESULTS'));
        console.log('='.repeat(60));

        const groupedResults = this.groupResultsByType();

        Object.keys(groupedResults).forEach(type => {
            console.log(chalk.cyan.bold(`\n${type.toUpperCase()} SERVICES`));
            console.log('-'.repeat(40));

            groupedResults[type].forEach(result => {
                const icon = this.getStatusIcon(result.status);
                const color = this.getStatusColor(result.status);
                
                console.log(color(`${icon} ${result.name.padEnd(20)} ${result.message}`));
            });
        });

        console.log('\n' + '='.repeat(60));
        
        const overall = this.getOverallHealth();
        const summaryColor = overall.status === 'healthy' ? chalk.green : 
                           overall.status === 'warning' ? chalk.yellow : chalk.red;
        
        console.log(summaryColor.bold(`🏥 OVERALL HEALTH: ${overall.status.toUpperCase()}`));
        console.log(summaryColor(overall.message));
        console.log('='.repeat(60) + '\n');

        // Recommendations
        this.printRecommendations();
    }

    printRecommendations() {
        const downServices = this.results.filter(r => r.status === 'down' || r.status === 'error');
        const timeoutServices = this.results.filter(r => r.status === 'timeout');

        if (downServices.length > 0 || timeoutServices.length > 0) {
            console.log(chalk.yellow.bold('💡 RECOMMENDATIONS'));
            console.log('-'.repeat(40));

            if (downServices.length > 0) {
                console.log(chalk.yellow('To start missing services:'));
                console.log(chalk.gray('  make docker-up          # Start all services'));
                console.log(chalk.gray('  docker-compose up -d    # Alternative method'));
            }

            if (timeoutServices.length > 0) {
                console.log(chalk.yellow('For timeout issues:'));
                console.log(chalk.gray('  Check resource usage: docker stats'));
                console.log(chalk.gray('  Check logs: make logs'));
            }

            console.log();
        }
    }

    groupResultsByType() {
        const grouped = {};
        this.results.forEach(result => {
            if (!grouped[result.type]) {
                grouped[result.type] = [];
            }
            grouped[result.type].push(result);
        });
        return grouped;
    }

    getStatusIcon(status) {
        switch (status) {
            case 'healthy': return '✅';
            case 'warning': return '⚠️';
            case 'down': return '🔴';
            case 'timeout': return '⏱️';
            case 'error': return '❌';
            default: return '❓';
        }
    }

    getStatusColor(status) {
        switch (status) {
            case 'healthy': return chalk.green;
            case 'warning': return chalk.yellow;
            case 'down': return chalk.red;
            case 'timeout': return chalk.magenta;
            case 'error': return chalk.red;
            default: return chalk.gray;
        }
    }

    getOverallHealth() {
        const healthyCount = this.results.filter(r => r.status === 'healthy').length;
        const warningCount = this.results.filter(r => r.status === 'warning').length;
        const errorCount = this.results.filter(r => r.status === 'down' || r.status === 'error' || r.status === 'timeout').length;

        if (errorCount > 0) {
            return {
                status: 'critical',
                message: `${errorCount} critical issues, ${warningCount} warnings, ${healthyCount} healthy`
            };
        } else if (warningCount > 0) {
            return {
                status: 'warning',
                message: `${warningCount} warnings, ${healthyCount} healthy`
            };
        } else {
            return {
                status: 'healthy',
                message: `All ${healthyCount} components are healthy`
            };
        }
    }
}

// Run health check if called directly
if (require.main === module) {
    const checker = new HealthChecker();
    checker.checkHealth().then(health => {
        process.exit(health.status === 'healthy' ? 0 : 1);
    }).catch(error => {
        console.error(chalk.red('Health check failed:'), error.message);
        process.exit(1);
    });
}

module.exports = HealthChecker;