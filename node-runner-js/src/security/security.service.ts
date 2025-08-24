import { Logger } from 'pino';
import { promises as fs } from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { networkInterfaces } from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export interface SecurityPolicy {
  networkPolicy: NetworkPolicy;
  resourceLimits: ResourceLimits;
  piiDetection: PIIDetectionConfig;
  accessControl: AccessControlPolicy;
  auditConfig: AuditConfig;
}

export interface NetworkPolicy {
  allowedDomains: string[];
  allowedIPs: string[];
  blockedDomains: string[];
  blockedIPs: string[];
  allowedPorts: number[];
  blockedPorts: number[];
  maxConnections: number;
  bandwidthLimit: number; // KB/s
  dnsRestrictions: DNSRestrictions;
  firewallRules: FirewallRule[];
}

export interface DNSRestrictions {
  allowedResolvers: string[];
  blockedDomains: string[];
  cacheTTL: number;
  enableDNSLogging: boolean;
}

export interface FirewallRule {
  id: string;
  direction: 'inbound' | 'outbound';
  protocol: 'tcp' | 'udp' | 'icmp' | 'any';
  sourceIP?: string;
  sourcePort?: number;
  destinationIP?: string;
  destinationPort?: number;
  action: 'allow' | 'deny' | 'log';
  priority: number;
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxDiskMB: number;
  maxNetworkMbps: number;
  maxExecutionTime: number; // seconds
  maxFileDescriptors: number;
  maxProcesses: number;
  maxThreads: number;
}

export interface PIIDetectionConfig {
  enabled: boolean;
  sensitivity: 'low' | 'medium' | 'high';
  redactionMode: 'mask' | 'remove' | 'hash';
  customPatterns: PIIPattern[];
  compliance: ComplianceConfig;
}

export interface PIIPattern {
  name: string;
  pattern: RegExp;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ComplianceConfig {
  gdprEnabled: boolean;
  ccpaEnabled: boolean;
  hipaaEnabled: boolean;
  pciDssEnabled: boolean;
  customRules: string[];
}

export interface AccessControlPolicy {
  allowedModules: string[];
  blockedModules: string[];
  allowedEnvironmentVars: string[];
  blockedEnvironmentVars: string[];
  allowedFileSystemPaths: string[];
  blockedFileSystemPaths: string[];
  allowedNetworkOperations: string[];
  allowedSystemCalls: string[];
}

export interface AuditConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logNetworkRequests: boolean;
  logFileAccess: boolean;
  logSystemCalls: boolean;
  logPIIDetection: boolean;
  retentionDays: number;
}

export interface SecurityViolation {
  id: string;
  type: 'network' | 'filesystem' | 'module' | 'resource' | 'pii' | 'access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: string;
  details: Record<string, any>;
  remediationAction?: string;
  blocked: boolean;
}

export interface NetworkRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  timestamp: string;
  sourceIP: string;
  destinationIP?: string;
  port?: number;
}

export class SecurityService {
  private logger: Logger;
  private policy: SecurityPolicy;
  private violations: SecurityViolation[] = [];
  private networkRequests: NetworkRequest[] = [];
  private piiPatterns: Map<string, PIIPattern>;

  constructor(logger: Logger, policy: SecurityPolicy) {
    this.logger = logger;
    this.policy = policy;
    this.piiPatterns = new Map();
    
    this.initializePIIPatterns();
    this.initializeNetworkFiltering();
  }

  /**
   * Initialize PII detection patterns
   */
  private initializePIIPatterns(): void {
    const defaultPatterns: PIIPattern[] = [
      {
        name: 'email',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        description: 'Email addresses',
        severity: 'medium'
      },
      {
        name: 'phone',
        pattern: /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
        description: 'Phone numbers',
        severity: 'medium'
      },
      {
        name: 'ssn',
        pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
        description: 'Social Security Numbers',
        severity: 'high'
      },
      {
        name: 'creditCard',
        pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
        description: 'Credit card numbers',
        severity: 'high'
      },
      {
        name: 'ipAddress',
        pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
        description: 'IP addresses',
        severity: 'low'
      },
      {
        name: 'passport',
        pattern: /\b[A-Z]{1,2}[0-9]{6,9}\b/g,
        description: 'Passport numbers',
        severity: 'high'
      },
      {
        name: 'driverLicense',
        pattern: /\b[A-Z]{1,2}[0-9]{6,8}\b/g,
        description: 'Driver license numbers',
        severity: 'medium'
      }
    ];

    // Add default patterns
    defaultPatterns.forEach(pattern => {
      this.piiPatterns.set(pattern.name, pattern);
    });

    // Add custom patterns from config
    this.policy.piiDetection.customPatterns.forEach(pattern => {
      this.piiPatterns.set(pattern.name, pattern);
    });
  }

  /**
   * Initialize network filtering rules
   */
  private async initializeNetworkFiltering(): Promise<void> {
    try {
      if (process.platform === 'linux') {
        await this.setupLinuxFirewallRules();
      } else if (process.platform === 'darwin') {
        await this.setupMacOSFirewallRules();
      } else {
        this.logger.warn('Network filtering not fully supported on this platform');
      }
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to initialize network filtering');
    }
  }

  /**
   * Setup Linux iptables rules
   */
  private async setupLinuxFirewallRules(): Promise<void> {
    const rules = this.policy.networkPolicy.firewallRules;
    
    // Clear existing rules for our chain
    await execAsync('iptables -F N8N_WORK_FILTER 2>/dev/null || true');
    await execAsync('iptables -X N8N_WORK_FILTER 2>/dev/null || true');
    
    // Create our custom chain
    await execAsync('iptables -N N8N_WORK_FILTER');
    
    // Apply firewall rules
    for (const rule of rules.sort((a, b) => a.priority - b.priority)) {
      const iptablesRule = this.buildIptablesRule(rule);
      await execAsync(`iptables -A N8N_WORK_FILTER ${iptablesRule}`);
    }
    
    // Insert our chain into the OUTPUT chain
    await execAsync('iptables -I OUTPUT -j N8N_WORK_FILTER');
    
    this.logger.info({ rulesCount: rules.length }, 'Linux firewall rules applied');
  }

  /**
   * Setup macOS pfctl rules
   */
  private async setupMacOSFirewallRules(): Promise<void> {
    // macOS firewall rules using pfctl
    try {
      const rules = this.policy.networkPolicy.firewallRules;
      
      // Create temporary pf rules file
      const rulesFile = path.join(os.tmpdir(), `n8n-work-firewall-${Date.now()}.conf`);
      
      let pfRules = '# N8N-Work Firewall Rules\n';
      pfRules += 'set block-policy drop\n';
      pfRules += 'set skip on lo0\n';
      
      // Add allow rules
      for (const rule of rules.filter(r => r.action === 'allow')) {
        if (rule.destinationPort) {
          pfRules += `pass out proto tcp from any to any port ${rule.destinationPort}\n`;
        }
        if (rule.destinationIP) {
          pfRules += `pass out proto tcp from any to ${rule.destinationIP}\n`;
        }
      }
      
      // Add block rules
      pfRules += 'block out all\n';
      
      await fs.writeFile(rulesFile, pfRules);
      
      // Apply rules
      await execAsync(`pfctl -f ${rulesFile}`);
      await execAsync('pfctl -e');
      
      this.logger.info({ rulesCount: rules.length }, 'macOS firewall rules applied');
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to setup macOS firewall rules');
      throw error;
    }
  }

  /**
   * Build iptables rule string from FirewallRule
   */
  private buildIptablesRule(rule: FirewallRule): string {
    let ruleStr = '';
    
    if (rule.protocol !== 'any') {
      ruleStr += `-p ${rule.protocol} `;
    }
    
    if (rule.destinationIP) {
      ruleStr += `-d ${rule.destinationIP} `;
    }
    
    if (rule.destinationPort) {
      ruleStr += `--dport ${rule.destinationPort} `;
    }
    
    if (rule.sourceIP) {
      ruleStr += `-s ${rule.sourceIP} `;
    }
    
    if (rule.sourcePort) {
      ruleStr += `--sport ${rule.sourcePort} `;
    }
    
    switch (rule.action) {
      case 'allow':
        ruleStr += '-j ACCEPT';
        break;
      case 'deny':
        ruleStr += '-j DROP';
        break;
      case 'log':
        ruleStr += '-j LOG --log-prefix "N8N_WORK: "';
        break;
    }
    
    return ruleStr;
  }

  /**
   * Validate network request against policy
   */
  async validateNetworkRequest(request: NetworkRequest): Promise<{ allowed: boolean; violations: SecurityViolation[] }> {
    const violations: SecurityViolation[] = [];
    let allowed = true;

    // Extract domain from URL
    const url = new URL(request.url);
    const domain = url.hostname;
    const port = parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);

    // Check allowed domains
    if (this.policy.networkPolicy.allowedDomains.length > 0) {
      const domainAllowed = this.policy.networkPolicy.allowedDomains.some(allowedDomain => {
        return domain === allowedDomain || domain.endsWith(`.${allowedDomain}`);
      });
      
      if (!domainAllowed) {
        allowed = false;
        violations.push({
          id: `net_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'network',
          severity: 'high',
          description: `Domain ${domain} is not in allowed domains list`,
          timestamp: new Date().toISOString(),
          details: { domain, allowedDomains: this.policy.networkPolicy.allowedDomains },
          blocked: true
        });
      }
    }

    // Check blocked domains
    const domainBlocked = this.policy.networkPolicy.blockedDomains.some(blockedDomain => {
      return domain === blockedDomain || domain.endsWith(`.${blockedDomain}`);
    });
    
    if (domainBlocked) {
      allowed = false;
      violations.push({
        id: `net_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'network',
        severity: 'high',
        description: `Domain ${domain} is in blocked domains list`,
        timestamp: new Date().toISOString(),
        details: { domain, blockedDomains: this.policy.networkPolicy.blockedDomains },
        blocked: true
      });
    }

    // Check allowed ports
    if (this.policy.networkPolicy.allowedPorts.length > 0) {
      if (!this.policy.networkPolicy.allowedPorts.includes(port)) {
        allowed = false;
        violations.push({
          id: `net_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'network',
          severity: 'medium',
          description: `Port ${port} is not in allowed ports list`,
          timestamp: new Date().toISOString(),
          details: { port, allowedPorts: this.policy.networkPolicy.allowedPorts },
          blocked: true
        });
      }
    }

    // Check blocked ports
    if (this.policy.networkPolicy.blockedPorts.includes(port)) {
      allowed = false;
      violations.push({
        id: `net_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'network',
        severity: 'medium',
        description: `Port ${port} is in blocked ports list`,
        timestamp: new Date().toISOString(),
        details: { port, blockedPorts: this.policy.networkPolicy.blockedPorts },
        blocked: true
      });
    }

    // Log network request if auditing is enabled
    if (this.policy.auditConfig.logNetworkRequests) {
      this.networkRequests.push(request);
      this.logger.info({
        url: request.url,
        method: request.method,
        allowed,
        violations: violations.length
      }, 'Network request audited');
    }

    // Store violations
    this.violations.push(...violations);

    return { allowed, violations };
  }

  /**
   * Detect PII in data
   */
  validatePII(data: any): { hasPII: boolean; detectedTypes: string[]; violations: SecurityViolation[] } {
    if (!this.policy.piiDetection.enabled) {
      return { hasPII: false, detectedTypes: [], violations: [] };
    }

    const detectedTypes: string[] = [];
    const violations: SecurityViolation[] = [];
    const dataString = JSON.stringify(data);

    for (const [type, pattern] of this.piiPatterns) {
      const matches = dataString.match(pattern.pattern);
      if (matches && matches.length > 0) {
        detectedTypes.push(type);
        
        const violation: SecurityViolation = {
          id: `pii_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'pii',
          severity: pattern.severity,
          description: `Detected ${pattern.description} in data`,
          timestamp: new Date().toISOString(),
          details: {
            type,
            matchCount: matches.length,
            pattern: pattern.description,
            compliance: this.getComplianceRequirements(type)
          },
          blocked: this.shouldBlockPII(pattern.severity)
        };
        
        violations.push(violation);
      }
    }

    // Store violations
    this.violations.push(...violations);

    // Log PII detection if auditing is enabled
    if (this.policy.auditConfig.logPIIDetection && detectedTypes.length > 0) {
      this.logger.warn({
        detectedTypes,
        violationCount: violations.length
      }, 'PII detected in data');
    }

    return {
      hasPII: detectedTypes.length > 0,
      detectedTypes,
      violations
    };
  }

  /**
   * Redact PII from data
   */
  redactPII(data: any): any {
    if (!this.policy.piiDetection.enabled) {
      return data;
    }

    let dataString = JSON.stringify(data);

    for (const [type, pattern] of this.piiPatterns) {
      switch (this.policy.piiDetection.redactionMode) {
        case 'mask':
          dataString = dataString.replace(pattern.pattern, (match) => '*'.repeat(match.length));
          break;
        case 'remove':
          dataString = dataString.replace(pattern.pattern, '[REDACTED]');
          break;
        case 'hash':
          dataString = dataString.replace(pattern.pattern, (match) => `[HASH:${this.hashValue(match)}]`);
          break;
      }
    }

    try {
      return JSON.parse(dataString);
    } catch (error) {
      // If parsing fails, return the redacted string
      return dataString;
    }
  }

  /**
   * Validate module access
   */
  validateModuleAccess(moduleName: string): { allowed: boolean; violations: SecurityViolation[] } {
    const violations: SecurityViolation[] = [];
    let allowed = true;

    // Check blocked modules first
    if (this.policy.accessControl.blockedModules.includes(moduleName)) {
      allowed = false;
      violations.push({
        id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'module',
        severity: 'high',
        description: `Module ${moduleName} is in blocked modules list`,
        timestamp: new Date().toISOString(),
        details: { moduleName, blockedModules: this.policy.accessControl.blockedModules },
        blocked: true
      });
    }

    // Check allowed modules
    if (this.policy.accessControl.allowedModules.length > 0) {
      if (!this.policy.accessControl.allowedModules.includes(moduleName)) {
        allowed = false;
        violations.push({
          id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'module',
          severity: 'medium',
          description: `Module ${moduleName} is not in allowed modules list`,
          timestamp: new Date().toISOString(),
          details: { moduleName, allowedModules: this.policy.accessControl.allowedModules },
          blocked: true
        });
      }
    }

    this.violations.push(...violations);
    return { allowed, violations };
  }

  /**
   * Monitor resource usage
   */
  monitorResourceUsage(usage: {
    memoryMB: number;
    cpuPercent: number;
    diskMB: number;
    networkMbps: number;
    executionTime: number;
  }): { violations: SecurityViolation[] } {
    const violations: SecurityViolation[] = [];
    const limits = this.policy.resourceLimits;

    // Check memory usage
    if (usage.memoryMB > limits.maxMemoryMB) {
      violations.push({
        id: `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'resource',
        severity: 'high',
        description: `Memory usage ${usage.memoryMB}MB exceeds limit ${limits.maxMemoryMB}MB`,
        timestamp: new Date().toISOString(),
        details: { current: usage.memoryMB, limit: limits.maxMemoryMB, type: 'memory' },
        blocked: true
      });
    }

    // Check CPU usage
    if (usage.cpuPercent > limits.maxCpuPercent) {
      violations.push({
        id: `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'resource',
        severity: 'medium',
        description: `CPU usage ${usage.cpuPercent}% exceeds limit ${limits.maxCpuPercent}%`,
        timestamp: new Date().toISOString(),
        details: { current: usage.cpuPercent, limit: limits.maxCpuPercent, type: 'cpu' },
        blocked: false
      });
    }

    // Check execution time
    if (usage.executionTime > limits.maxExecutionTime) {
      violations.push({
        id: `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'resource',
        severity: 'high',
        description: `Execution time ${usage.executionTime}s exceeds limit ${limits.maxExecutionTime}s`,
        timestamp: new Date().toISOString(),
        details: { current: usage.executionTime, limit: limits.maxExecutionTime, type: 'time' },
        blocked: true
      });
    }

    this.violations.push(...violations);
    return { violations };
  }

  /**
   * Get security violations
   */
  getViolations(filter?: {
    type?: string;
    severity?: string;
    since?: Date;
  }): SecurityViolation[] {
    let violations = this.violations;

    if (filter) {
      violations = violations.filter(violation => {
        if (filter.type && violation.type !== filter.type) return false;
        if (filter.severity && violation.severity !== filter.severity) return false;
        if (filter.since && new Date(violation.timestamp) < filter.since) return false;
        return true;
      });
    }

    return violations;
  }

  /**
   * Clear old violations (for memory management)
   */
  clearOldViolations(olderThanDays: number = 7): void {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    this.violations = this.violations.filter(violation => 
      new Date(violation.timestamp) >= cutoff
    );

    this.networkRequests = this.networkRequests.filter(request =>
      new Date(request.timestamp) >= cutoff
    );
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    totalViolations: number;
    violationsByType: Record<string, number>;
    violationsBySeverity: Record<string, number>;
    networkRequests: number;
    blockedRequests: number;
  } {
    const violationsByType: Record<string, number> = {};
    const violationsBySeverity: Record<string, number> = {};
    let blockedRequests = 0;

    this.violations.forEach(violation => {
      violationsByType[violation.type] = (violationsByType[violation.type] || 0) + 1;
      violationsBySeverity[violation.severity] = (violationsBySeverity[violation.severity] || 0) + 1;
      
      if (violation.blocked) {
        blockedRequests++;
      }
    });

    return {
      totalViolations: this.violations.length,
      violationsByType,
      violationsBySeverity,
      networkRequests: this.networkRequests.length,
      blockedRequests
    };
  }

  /**
   * Export security audit log
   */
  exportAuditLog(): {
    violations: SecurityViolation[];
    networkRequests: NetworkRequest[];
    statistics: ReturnType<typeof this.getSecurityStats>;
    exportTime: string;
  } {
    return {
      violations: this.violations,
      networkRequests: this.networkRequests,
      statistics: this.getSecurityStats(),
      exportTime: new Date().toISOString()
    };
  }

  /**
   * Clean up security service
   */
  async cleanup(): Promise<void> {
    try {
      // Remove iptables rules if on Linux
      if (process.platform === 'linux') {
        await execAsync('iptables -D OUTPUT -j N8N_WORK_FILTER 2>/dev/null || true');
        await execAsync('iptables -F N8N_WORK_FILTER 2>/dev/null || true');
        await execAsync('iptables -X N8N_WORK_FILTER 2>/dev/null || true');
      }
      
      this.logger.info('Security service cleanup completed');
    } catch (error) {
      this.logger.error({ error: error.message }, 'Error during security service cleanup');
    }
  }

  // Private helper methods

  private shouldBlockPII(severity: string): boolean {
    const sensitivity = this.policy.piiDetection.sensitivity;
    
    switch (sensitivity) {
      case 'low':
        return severity === 'high';
      case 'medium':
        return severity === 'high' || severity === 'medium';
      case 'high':
        return true;
      default:
        return false;
    }
  }

  private getComplianceRequirements(piiType: string): string[] {
    const requirements: string[] = [];
    
    if (this.policy.piiDetection.compliance.gdprEnabled) {
      requirements.push('GDPR');
    }
    
    if (this.policy.piiDetection.compliance.ccpaEnabled) {
      requirements.push('CCPA');
    }
    
    if (this.policy.piiDetection.compliance.hipaaEnabled && 
        ['ssn', 'medicalRecord', 'healthInfo'].includes(piiType)) {
      requirements.push('HIPAA');
    }
    
    if (this.policy.piiDetection.compliance.pciDssEnabled && 
        piiType === 'creditCard') {
      requirements.push('PCI DSS');
    }
    
    return requirements;
  }

  private hashValue(value: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(value).digest('hex').substring(0, 8);
  }
}