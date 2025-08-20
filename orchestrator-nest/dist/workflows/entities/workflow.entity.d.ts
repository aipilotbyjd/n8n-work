import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../auth/entities/user.entity';
import { Execution } from '../../executions/entities/execution.entity';
export declare enum WorkflowStatus {
    DRAFT = "draft",
    ACTIVE = "active",
    INACTIVE = "inactive",
    DEPRECATED = "deprecated"
}
export interface WorkflowNode {
    id: string;
    type: string;
    name: string;
    parameters: Record<string, any>;
    dependencies: string[];
    position: {
        x: number;
        y: number;
    };
    policy: {
        timeoutSeconds: number;
        retryCount: number;
        retryStrategy: string;
        allowedDomains: string[];
        resourceLimits: Record<string, any>;
    };
}
export interface WorkflowEdge {
    fromNode: string;
    toNode: string;
    condition?: string;
}
export declare class Workflow {
    id: string;
    name: string;
    description: string;
    status: WorkflowStatus;
    version: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    metadata: Record<string, any>;
    triggerConfig: Record<string, any>;
    scheduleConfig: Record<string, any>;
    executionCount: number;
    successCount: number;
    failureCount: number;
    avgExecutionTimeMs: number;
    lastExecutionAt: Date;
    isEnabled: boolean;
    tenantId: string;
    createdBy: string;
    updatedBy: string;
    createdAt: Date;
    updatedAt: Date;
    tenant: Tenant;
    creator: User;
    updater: User;
    executions: Execution[];
    get successRate(): number;
    get failureRate(): number;
    get isActive(): boolean;
}
