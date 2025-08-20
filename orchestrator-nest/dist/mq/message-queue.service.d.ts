import { ConfigService } from '@nestjs/config';
export declare class MessageQueueService {
    private configService;
    private readonly logger;
    constructor(configService: ConfigService);
    publishWorkflowExecution(workflowExecution: any): Promise<void>;
    publishStepExecution(stepExecution: any): Promise<void>;
    publishEvent(event: any): Promise<void>;
}
