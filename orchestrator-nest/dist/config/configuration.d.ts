export declare const configuration: () => {
    app: {
        name: string;
        version: string;
        environment: string;
        port: number;
        corsOrigin: string;
    };
    database: {
        type: string;
        host: string;
        port: number;
        username: string;
        password: string;
        database: string;
        ssl: boolean;
        synchronize: boolean;
        logging: boolean;
        migrationsRun: true;
    };
    redis: {
        host: string;
        port: number;
        password: string;
        db: number;
        keyPrefix: string;
    };
    messageQueue: {
        url: string;
        exchanges: {
            workflow: string;
            execution: string;
            events: string;
        };
        queues: {
            workflowExecution: string;
            stepExecution: string;
            eventNotification: string;
        };
    };
    auth: {
        jwtSecret: string;
        jwtExpiresIn: string;
        bcryptRounds: number;
        apiKeyHeader: string;
    };
    encryption: {
        algorithm: string;
        key: string;
    };
    services: {
        engineGrpcUrl: string;
        nodeRunnerUrl: string;
        clickhouseUrl: string;
        minioEndpoint: string;
        minioAccessKey: string;
        minioSecretKey: string;
    };
    observability: {
        otlpEndpoint: string;
        serviceName: string;
        serviceVersion: string;
        enableTracing: boolean;
        enableMetrics: boolean;
        enableLogs: boolean;
    };
    rateLimit: {
        defaultTtl: number;
        defaultLimit: number;
    };
    features: {
        enableWebhooks: boolean;
        enableMarketplace: boolean;
        enableBilling: boolean;
        enableAdvancedAuth: boolean;
        enableMultiTenancy: boolean;
    };
    limits: {
        maxWorkflowSize: number;
        maxExecutionTime: number;
        maxConcurrentExecutions: number;
        maxRetryAttempts: number;
    };
    storage: {
        artifactsBucket: string;
        backupsBucket: string;
        tempBucket: string;
    };
    notifications: {
        defaultChannels: string[];
        emailProvider: string;
        slackWebhookUrl: string;
    };
};
