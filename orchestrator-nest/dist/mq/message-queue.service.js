"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MessageQueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageQueueService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let MessageQueueService = MessageQueueService_1 = class MessageQueueService {
    configService;
    logger = new common_1.Logger(MessageQueueService_1.name);
    constructor(configService) {
        this.configService = configService;
    }
    async publishWorkflowExecution(workflowExecution) {
        this.logger.log('Publishing workflow execution', { id: workflowExecution.id });
    }
    async publishStepExecution(stepExecution) {
        this.logger.log('Publishing step execution', { id: stepExecution.id });
    }
    async publishEvent(event) {
        this.logger.log('Publishing event', { type: event.type });
    }
};
exports.MessageQueueService = MessageQueueService;
exports.MessageQueueService = MessageQueueService = MessageQueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MessageQueueService);
//# sourceMappingURL=message-queue.service.js.map