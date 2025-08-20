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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var WorkflowsService_1;
var _a, _b, _c, _d, _e;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const cache_manager_1 = require("cache-manager");
const cache_manager_2 = require("@nestjs/cache-manager");
const common_2 = require("@nestjs/common");
const workflow_entity_1 = require("./entities/workflow.entity");
const workflow_validation_service_1 = require("./workflow-validation.service");
const tenants_service_1 = require("../tenants/tenants.service");
const workflow_compiler_service_1 = require("./workflow-compiler.service");
const metrics_service_1 = require("../observability/metrics.service");
const audit_log_service_1 = require("../audit/audit-log.service");
let WorkflowsService = WorkflowsService_1 = class WorkflowsService {
    workflowRepository;
    cacheManager;
    eventEmitter;
    workflowValidationService;
    workflowCompilerService;
    tenantService;
    metricsService;
    auditLogService;
    logger = new common_1.Logger(WorkflowsService_1.name);
    constructor(workflowRepository, cacheManager, eventEmitter, workflowValidationService, workflowCompilerService, tenantService, metricsService, auditLogService) {
        this.workflowRepository = workflowRepository;
        this.cacheManager = cacheManager;
        this.eventEmitter = eventEmitter;
        this.workflowValidationService = workflowValidationService;
        this.workflowCompilerService = workflowCompilerService;
        this.tenantService = tenantService;
        this.metricsService = metricsService;
        this.auditLogService = auditLogService;
    }
    async create(createWorkflowDto, user) {
        this.logger.debug(`Creating workflow ${createWorkflowDto.name} for tenant ${user.tenantId}`);
        await this.tenantService.validateTenantAccess(user.tenantId, user.userId);
        const existingWorkflow = await this.workflowRepository.findOne({
            where: {
                name: createWorkflowDto.name,
                tenantId: user.tenantId,
            },
        });
        if (existingWorkflow) {
            throw new common_1.ConflictException(`Workflow with name '${createWorkflowDto.name}' already exists in this tenant`);
        }
        const validationResult = await this.workflowValidationService.validateWorkflow({
            nodes: createWorkflowDto.nodes,
            edges: createWorkflowDto.edges,
        });
        if (!validationResult.isValid) {
            throw new common_1.BadRequestException({
                message: 'Workflow validation failed',
                errors: validationResult.errors,
            });
        }
        const workflow = this.workflowRepository.create({
            ...createWorkflowDto,
            tenantId: user.tenantId,
            createdBy: user.userId,
            status: workflow_entity_1.WorkflowStatus.DRAFT,
        });
        const savedWorkflow = await this.workflowRepository.save(workflow);
        await this.clearWorkflowCache(user.tenantId);
        this.eventEmitter.emit('workflow.created', {
            workflow: savedWorkflow,
            user,
        });
        await this.auditLogService.logWorkflowEvent({
            action: 'create',
            workflowId: savedWorkflow.id,
            tenantId: user.tenantId,
            userId: user.userId,
            metadata: {
                workflowName: savedWorkflow.name,
                nodeCount: savedWorkflow.nodes.length,
            },
        });
        this.metricsService.incrementCounter('workflows_created_total', {
            tenant_id: user.tenantId,
        });
        this.logger.log(`Created workflow ${savedWorkflow.id} (${savedWorkflow.name}) for tenant ${user.tenantId}`);
        return savedWorkflow;
    }
    async findAll(listWorkflowsDto, user) {
        const { page = 1, limit = 10, status, search, sortBy = 'createdAt', sortOrder = 'DESC', } = listWorkflowsDto;
        const cacheKey = `workflows:${user.tenantId}:${JSON.stringify(listWorkflowsDto)}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            this.logger.debug(`Cache hit for workflows list: ${cacheKey}`);
            return cached;
        }
        const where = {
            tenantId: user.tenantId,
        };
        if (status) {
            where.status = status;
        }
        const options = {
            where,
            take: limit,
            skip: (page - 1) * limit,
            order: {
                [sortBy]: sortOrder,
            },
            relations: ['creator'],
        };
        if (search) {
            const searchTerm = `%${search}%`;
            options.where = [
                { ...where, name: searchTerm },
                { ...where, description: searchTerm },
            ];
        }
        const [workflows, total] = await this.workflowRepository.findAndCount(options);
        const result = {
            items: workflows,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasNext: page < Math.ceil(total / limit),
            hasPrevious: page > 1,
        };
        await this.cacheManager.set(cacheKey, result, 300);
        this.logger.debug(`Retrieved ${workflows.length} workflows for tenant ${user.tenantId}`);
        return result;
    }
    async findOne(id, user) {
        const cacheKey = `workflow:${id}:${user.tenantId}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            this.logger.debug(`Cache hit for workflow: ${cacheKey}`);
            return cached;
        }
        const workflow = await this.workflowRepository.findOne({
            where: {
                id,
                tenantId: user.tenantId,
            },
            relations: ['creator', 'updater'],
        });
        if (!workflow) {
            throw new common_1.NotFoundException(`Workflow with ID ${id} not found`);
        }
        await this.cacheManager.set(cacheKey, workflow, 600);
        this.logger.debug(`Retrieved workflow ${id} for tenant ${user.tenantId}`);
        return workflow;
    }
    async update(id, updateWorkflowDto, user) {
        this.logger.debug(`Updating workflow ${id} for tenant ${user.tenantId}`);
        const workflow = await this.findOne(id, user);
        if (workflow.createdBy !== user.userId && !user.permissions.includes('workflow:update')) {
            throw new common_1.ForbiddenException('Insufficient permissions to update this workflow');
        }
        if (workflow.status === workflow_entity_1.WorkflowStatus.ACTIVE) {
            const hasBreakingChanges = await this.workflowValidationService.hasBreakingChanges(workflow, updateWorkflowDto);
            if (hasBreakingChanges) {
                throw new common_1.BadRequestException('Cannot make breaking changes to an active workflow. Please create a new version or deactivate first.');
            }
        }
        if (updateWorkflowDto.nodes || updateWorkflowDto.edges) {
            const validationResult = await this.workflowValidationService.validateWorkflow({
                nodes: updateWorkflowDto.nodes || workflow.nodes,
                edges: updateWorkflowDto.edges || workflow.edges,
            });
            if (!validationResult.isValid) {
                throw new common_1.BadRequestException({
                    message: 'Updated workflow validation failed',
                    errors: validationResult.errors,
                });
            }
        }
        Object.assign(workflow, updateWorkflowDto, {
            updatedBy: user.userId,
        });
        const updatedWorkflow = await this.workflowRepository.save(workflow);
        await this.clearWorkflowCache(user.tenantId, id);
        this.eventEmitter.emit('workflow.updated', {
            workflow: updatedWorkflow,
            previousVersion: workflow,
            user,
        });
        await this.auditLogService.logWorkflowEvent({
            action: 'update',
            workflowId: id,
            tenantId: user.tenantId,
            userId: user.userId,
            metadata: {
                workflowName: updatedWorkflow.name,
                changes: updateWorkflowDto,
            },
        });
        this.metricsService.incrementCounter('workflows_updated_total', {
            tenant_id: user.tenantId,
        });
        this.logger.log(`Updated workflow ${id} for tenant ${user.tenantId}`);
        return updatedWorkflow;
    }
    async remove(id, user) {
        this.logger.debug(`Removing workflow ${id} for tenant ${user.tenantId}`);
        const workflow = await this.findOne(id, user);
        if (workflow.createdBy !== user.userId && !user.permissions.includes('workflow:delete')) {
            throw new common_1.ForbiddenException('Insufficient permissions to delete this workflow');
        }
        if (workflow.status === workflow_entity_1.WorkflowStatus.ACTIVE) {
            throw new common_1.BadRequestException('Cannot delete an active workflow. Please deactivate it first.');
        }
        const hasRecentExecutions = await this.hasRecentExecutions(id);
        if (hasRecentExecutions) {
            throw new common_1.BadRequestException('Cannot delete a workflow with executions in the last 30 days. Please archive instead.');
        }
        await this.workflowRepository.remove(workflow);
        await this.clearWorkflowCache(user.tenantId, id);
        this.eventEmitter.emit('workflow.deleted', {
            workflow,
            user,
        });
        await this.auditLogService.logWorkflowEvent({
            action: 'delete',
            workflowId: id,
            tenantId: user.tenantId,
            userId: user.userId,
            metadata: {
                workflowName: workflow.name,
            },
        });
        this.metricsService.incrementCounter('workflows_deleted_total', {
            tenant_id: user.tenantId,
        });
        this.logger.log(`Deleted workflow ${id} for tenant ${user.tenantId}`);
    }
    async activate(id, user) {
        this.logger.debug(`Activating workflow ${id} for tenant ${user.tenantId}`);
        const workflow = await this.findOne(id, user);
        if (workflow.status === workflow_entity_1.WorkflowStatus.ACTIVE) {
            throw new common_1.BadRequestException('Workflow is already active');
        }
        const validationResult = await this.workflowValidationService.validateWorkflow({
            nodes: workflow.nodes,
            edges: workflow.edges,
        });
        if (!validationResult.isValid) {
            throw new common_1.BadRequestException({
                message: 'Cannot activate workflow with validation errors',
                errors: validationResult.errors,
            });
        }
        const compilationResult = await this.workflowCompilerService.compile(workflow);
        if (!compilationResult.success) {
            throw new common_1.BadRequestException({
                message: 'Workflow compilation failed',
                errors: compilationResult.errors,
            });
        }
        workflow.status = workflow_entity_1.WorkflowStatus.ACTIVE;
        workflow.updatedBy = user.userId;
        const activatedWorkflow = await this.workflowRepository.save(workflow);
        await this.clearWorkflowCache(user.tenantId, id);
        this.eventEmitter.emit('workflow.activated', {
            workflow: activatedWorkflow,
            user,
        });
        await this.auditLogService.logWorkflowEvent({
            action: 'activate',
            workflowId: id,
            tenantId: user.tenantId,
            userId: user.userId,
            metadata: {
                workflowName: workflow.name,
            },
        });
        this.metricsService.incrementCounter('workflows_activated_total', {
            tenant_id: user.tenantId,
        });
        this.logger.log(`Activated workflow ${id} for tenant ${user.tenantId}`);
        return activatedWorkflow;
    }
    async deactivate(id, user) {
        this.logger.debug(`Deactivating workflow ${id} for tenant ${user.tenantId}`);
        const workflow = await this.findOne(id, user);
        if (workflow.status !== workflow_entity_1.WorkflowStatus.ACTIVE) {
            throw new common_1.BadRequestException('Workflow is not currently active');
        }
        workflow.status = workflow_entity_1.WorkflowStatus.INACTIVE;
        workflow.updatedBy = user.userId;
        const deactivatedWorkflow = await this.workflowRepository.save(workflow);
        await this.clearWorkflowCache(user.tenantId, id);
        this.eventEmitter.emit('workflow.deactivated', {
            workflow: deactivatedWorkflow,
            user,
        });
        await this.auditLogService.logWorkflowEvent({
            action: 'deactivate',
            workflowId: id,
            tenantId: user.tenantId,
            userId: user.userId,
            metadata: {
                workflowName: workflow.name,
            },
        });
        this.metricsService.incrementCounter('workflows_deactivated_total', {
            tenant_id: user.tenantId,
        });
        this.logger.log(`Deactivated workflow ${id} for tenant ${user.tenantId}`);
        return deactivatedWorkflow;
    }
    async getWorkflowStatistics(user) {
        const cacheKey = `workflow-stats:${user.tenantId}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) {
            return cached;
        }
        const stats = await this.workflowRepository
            .createQueryBuilder('workflow')
            .select([
            'COUNT(*) as total',
            'COUNT(CASE WHEN status = \'active\' THEN 1 END) as active',
            'COUNT(CASE WHEN status = \'draft\' THEN 1 END) as draft',
            'COUNT(CASE WHEN status = \'inactive\' THEN 1 END) as inactive',
            'SUM(execution_count) as total_executions',
            'SUM(success_count) as total_successes',
            'SUM(failure_count) as total_failures',
            'AVG(avg_execution_time_ms) as avg_execution_time',
        ])
            .where('tenant_id = :tenantId', { tenantId: user.tenantId })
            .getRawOne();
        const result = {
            totalWorkflows: parseInt(stats.total) || 0,
            activeWorkflows: parseInt(stats.active) || 0,
            draftWorkflows: parseInt(stats.draft) || 0,
            inactiveWorkflows: parseInt(stats.inactive) || 0,
            totalExecutions: parseInt(stats.total_executions) || 0,
            totalSuccesses: parseInt(stats.total_successes) || 0,
            totalFailures: parseInt(stats.total_failures) || 0,
            avgExecutionTimeMs: Math.round(parseFloat(stats.avg_execution_time) || 0),
            successRate: stats.total_executions > 0
                ? Math.round((stats.total_successes / stats.total_executions) * 100 * 100) / 100
                : 0,
        };
        await this.cacheManager.set(cacheKey, result, 300);
        return result;
    }
    async clearWorkflowCache(tenantId, workflowId) {
        const keys = [
            `workflows:${tenantId}:*`,
            `workflow-stats:${tenantId}`,
        ];
        if (workflowId) {
            keys.push(`workflow:${workflowId}:${tenantId}`);
        }
        await Promise.all(keys.map(key => this.cacheManager.del(key)));
    }
    async hasRecentExecutions(workflowId) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const count = await this.workflowRepository
            .createQueryBuilder('workflow')
            .leftJoin('workflow.executions', 'execution')
            .where('workflow.id = :workflowId', { workflowId })
            .andWhere('execution.created_at > :date', { date: thirtyDaysAgo })
            .getCount();
        return count > 0;
    }
};
exports.WorkflowsService = WorkflowsService;
exports.WorkflowsService = WorkflowsService = WorkflowsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(workflow_entity_1.Workflow)),
    __param(1, (0, common_2.Inject)(cache_manager_2.CACHE_MANAGER)),
    __metadata("design:paramtypes", [typeorm_2.Repository, typeof (_a = typeof cache_manager_1.Cache !== "undefined" && cache_manager_1.Cache) === "function" ? _a : Object, event_emitter_1.EventEmitter2, typeof (_b = typeof workflow_validation_service_1.WorkflowValidationService !== "undefined" && workflow_validation_service_1.WorkflowValidationService) === "function" ? _b : Object, typeof (_c = typeof workflow_compiler_service_1.WorkflowCompilerService !== "undefined" && workflow_compiler_service_1.WorkflowCompilerService) === "function" ? _c : Object, typeof (_d = typeof tenants_service_1.TenantService !== "undefined" && tenants_service_1.TenantService) === "function" ? _d : Object, metrics_service_1.MetricsService, typeof (_e = typeof audit_log_service_1.AuditLogService !== "undefined" && audit_log_service_1.AuditLogService) === "function" ? _e : Object])
], WorkflowsService);
//# sourceMappingURL=workflows.service.js.map