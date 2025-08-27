import { Injectable } from "@nestjs/common";

@Injectable()
export class AuditLogService {
  async log(
    action: string,
    resource: string,
    resourceId: string,
    userId: string,
    details?: any,
  ): Promise<void> {
    // Log audit event
    console.log(
      `AUDIT: ${action} ${resource} ${resourceId} by ${userId}`,
      details,
    );
  }

  async logWorkflowCreated(
    workflowId: string,
    workflowName: string,
    userId: string,
    nodeCount: number,
  ): Promise<void> {
    await this.log("CREATE", "WORKFLOW", workflowId, userId, {
      workflowName,
      nodeCount,
    });
  }

  async logWorkflowUpdated(workflowId: string, userId: string): Promise<void> {
    await this.log("UPDATE", "WORKFLOW", workflowId, userId);
  }

  async logWorkflowDeleted(workflowId: string, userId: string): Promise<void> {
    await this.log("DELETE", "WORKFLOW", workflowId, userId);
  }

  async logWorkflowActivated(
    workflowId: string,
    userId: string,
  ): Promise<void> {
    await this.log("ACTIVATE", "WORKFLOW", workflowId, userId);
  }

  async logWorkflowDeactivated(
    workflowId: string,
    userId: string,
  ): Promise<void> {
    await this.log("DEACTIVATE", "WORKFLOW", workflowId, userId);
  }
}
