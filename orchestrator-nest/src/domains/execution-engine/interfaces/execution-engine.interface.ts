
export interface IExecutionEngine {
  execute(workflowId: string, executionId: string, payload: any): Promise<void>;
}
