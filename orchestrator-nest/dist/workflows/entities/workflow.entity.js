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
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Workflow = exports.WorkflowStatus = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
const tenant_entity_1 = require("../../tenants/entities/tenant.entity");
const user_entity_1 = require("../../auth/entities/user.entity");
const execution_entity_1 = require("../../executions/entities/execution.entity");
var WorkflowStatus;
(function (WorkflowStatus) {
    WorkflowStatus["DRAFT"] = "draft";
    WorkflowStatus["ACTIVE"] = "active";
    WorkflowStatus["INACTIVE"] = "inactive";
    WorkflowStatus["DEPRECATED"] = "deprecated";
})(WorkflowStatus || (exports.WorkflowStatus = WorkflowStatus = {}));
let Workflow = class Workflow {
    id;
    name;
    description;
    status;
    version;
    nodes;
    edges;
    metadata;
    triggerConfig;
    scheduleConfig;
    executionCount;
    successCount;
    failureCount;
    avgExecutionTimeMs;
    lastExecutionAt;
    isEnabled;
    tenantId;
    createdBy;
    updatedBy;
    createdAt;
    updatedAt;
    tenant;
    creator;
    updater;
    executions;
    get successRate() {
        if (this.executionCount === 0)
            return 0;
        return (this.successCount / this.executionCount) * 100;
    }
    get failureRate() {
        if (this.executionCount === 0)
            return 0;
        return (this.failureCount / this.executionCount) * 100;
    }
    get isActive() {
        return this.status === WorkflowStatus.ACTIVE && this.isEnabled;
    }
};
exports.Workflow = Workflow;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Unique identifier for the workflow',
        example: 'uuid-v4',
    }),
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Workflow.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Human-readable name of the workflow',
        example: 'Customer Onboarding Process',
    }),
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], Workflow.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Detailed description of the workflow',
        example: 'Automated customer onboarding with email verification and welcome sequence',
    }),
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Workflow.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Current status of the workflow',
        enum: WorkflowStatus,
        example: WorkflowStatus.ACTIVE,
    }),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: WorkflowStatus,
        default: WorkflowStatus.DRAFT,
    }),
    __metadata("design:type", String)
], Workflow.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Version of the workflow',
        example: '1.0.0',
    }),
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: '1.0.0' }),
    __metadata("design:type", String)
], Workflow.prototype, "version", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Workflow nodes configuration',
        type: 'object',
        isArray: true,
    }),
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Array)
], Workflow.prototype, "nodes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Workflow edges configuration',
        type: 'object',
        isArray: true,
    }),
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Array)
], Workflow.prototype, "edges", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Workflow metadata and labels',
        type: 'object',
    }),
    (0, typeorm_1.Column)({ type: 'jsonb', default: {} }),
    __metadata("design:type", Object)
], Workflow.prototype, "metadata", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Workflow trigger configuration',
        type: 'object',
    }),
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], Workflow.prototype, "triggerConfig", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Workflow scheduling configuration',
        type: 'object',
    }),
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], Workflow.prototype, "scheduleConfig", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Number of times this workflow has been executed',
        example: 42,
    }),
    (0, typeorm_1.Column)({ type: 'bigint', default: 0 }),
    __metadata("design:type", Number)
], Workflow.prototype, "executionCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Number of successful executions',
        example: 38,
    }),
    (0, typeorm_1.Column)({ type: 'bigint', default: 0 }),
    __metadata("design:type", Number)
], Workflow.prototype, "successCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Number of failed executions',
        example: 4,
    }),
    (0, typeorm_1.Column)({ type: 'bigint', default: 0 }),
    __metadata("design:type", Number)
], Workflow.prototype, "failureCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Average execution time in milliseconds',
        example: 2500,
    }),
    (0, typeorm_1.Column)({ type: 'bigint', default: 0 }),
    __metadata("design:type", Number)
], Workflow.prototype, "avgExecutionTimeMs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Last execution timestamp',
        example: '2023-12-01T10:30:00Z',
    }),
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Workflow.prototype, "lastExecutionAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Whether the workflow is enabled for execution',
        example: true,
    }),
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], Workflow.prototype, "isEnabled", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Tenant ID this workflow belongs to',
        example: 'tenant-uuid',
    }),
    (0, typeorm_1.Column)({ type: 'uuid' }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], Workflow.prototype, "tenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID of the user who created this workflow',
        example: 'user-uuid',
    }),
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], Workflow.prototype, "createdBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ID of the user who last updated this workflow',
        example: 'user-uuid',
    }),
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Workflow.prototype, "updatedBy", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Timestamp when the workflow was created',
        example: '2023-11-01T08:00:00Z',
    }),
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Workflow.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Timestamp when the workflow was last updated',
        example: '2023-12-01T10:30:00Z',
    }),
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Workflow.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => tenant_entity_1.Tenant, { eager: false }),
    (0, typeorm_1.JoinColumn)({ name: 'tenantId' }),
    __metadata("design:type", typeof (_a = typeof tenant_entity_1.Tenant !== "undefined" && tenant_entity_1.Tenant) === "function" ? _a : Object)
], Workflow.prototype, "tenant", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { eager: false }),
    (0, typeorm_1.JoinColumn)({ name: 'createdBy' }),
    __metadata("design:type", typeof (_b = typeof user_entity_1.User !== "undefined" && user_entity_1.User) === "function" ? _b : Object)
], Workflow.prototype, "creator", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { eager: false }),
    (0, typeorm_1.JoinColumn)({ name: 'updatedBy' }),
    __metadata("design:type", typeof (_c = typeof user_entity_1.User !== "undefined" && user_entity_1.User) === "function" ? _c : Object)
], Workflow.prototype, "updater", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => execution_entity_1.Execution, (execution) => execution.workflow),
    __metadata("design:type", Array)
], Workflow.prototype, "executions", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Success rate percentage',
        example: 90.5,
    }),
    __metadata("design:type", Number),
    __metadata("design:paramtypes", [])
], Workflow.prototype, "successRate", null);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Failure rate percentage',
        example: 9.5,
    }),
    __metadata("design:type", Number),
    __metadata("design:paramtypes", [])
], Workflow.prototype, "failureRate", null);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Whether the workflow is currently active',
        example: true,
    }),
    __metadata("design:type", Boolean),
    __metadata("design:paramtypes", [])
], Workflow.prototype, "isActive", null);
exports.Workflow = Workflow = __decorate([
    (0, typeorm_1.Entity)('workflows'),
    (0, typeorm_1.Index)(['tenantId', 'status']),
    (0, typeorm_1.Index)(['tenantId', 'createdAt']),
    (0, typeorm_1.Index)(['name', 'tenantId'])
], Workflow);
//# sourceMappingURL=workflow.entity.js.map