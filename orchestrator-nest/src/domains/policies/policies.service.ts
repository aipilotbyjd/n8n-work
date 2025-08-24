import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Policy } from './entities/policy.entity';
import { PolicyAssignment, AssigneeType } from './entities/policy-assignment.entity';
import { CreatePolicyDto } from './dto/index';
import { UpdatePolicyDto } from './dto/index';
import { AssignPolicyDto } from './dto/index';
import { PolicyResponseDto } from './dto/index';
import { AuditLogService } from '../audit/audit-log.service';

export interface PolicyEvaluationContext {
  userId: string;
  tenantId: string;
  resource: string;
  action: string;
  resourceId?: string;
  metadata?: any;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  reason: string;
  appliedPolicies: string[];
}

@Injectable()
export class PoliciesService {
  constructor(
    @InjectRepository(Policy)
    private policyRepository: Repository<Policy>,
    @InjectRepository(PolicyAssignment)
    private policyAssignmentRepository: Repository<PolicyAssignment>,
    private eventEmitter: EventEmitter2,
    private auditLogService: AuditLogService,
  ) {}

  /**
   * Create a new policy
   */
  async createPolicy(
    tenantId: string,
    createPolicyDto: CreatePolicyDto,
    userId: string,
  ): Promise<PolicyResponseDto> {
    const existingPolicy = await this.policyRepository.findOne({
      where: { name: createPolicyDto.name, tenantId },
    });

    if (existingPolicy) {
      throw new BadRequestException('Policy with this name already exists');
    }

    const policy = this.policyRepository.create({
      ...createPolicyDto,
      tenantId,
      createdBy: userId,
    });

    const savedPolicy = await this.policyRepository.save(policy);

    // Emit policy created event
    this.eventEmitter.emit('policy.created', {
      tenantId,
      policyId: savedPolicy.id,
      policyName: savedPolicy.name,
      createdBy: userId,
    });

    // Log audit event
    await this.auditLogService.log({
      tenantId,
      userId,
      action: 'policy.created',
      resourceType: 'policy',
      resourceId: savedPolicy.id,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      newValues: { name: savedPolicy.name, type: savedPolicy.type }
    });

    return this.mapToPolicyResponse(savedPolicy);
  }

  /**
   * Update an existing policy
   */
  async updatePolicy(
    tenantId: string,
    policyId: string,
    updatePolicyDto: UpdatePolicyDto,
    userId: string,
  ): Promise<PolicyResponseDto> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId, tenantId },
    });

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    Object.assign(policy, updatePolicyDto);
    policy.updatedBy = userId;

    const savedPolicy = await this.policyRepository.save(policy);

    // Emit policy updated event
    this.eventEmitter.emit('policy.updated', {
      tenantId,
      policyId: savedPolicy.id,
      updatedBy: userId,
    });

    // Log audit event
    await this.auditLogService.log({
      tenantId,
      userId,
      action: 'policy.updated',
      resourceType: 'policy',
      resourceId: savedPolicy.id,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      newValues: updatePolicyDto
    });

    return this.mapToPolicyResponse(savedPolicy);
  }

  /**
   * Get policy by ID
   */
  async getPolicy(tenantId: string, policyId: string): Promise<PolicyResponseDto> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId, tenantId },
    });

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    return this.mapToPolicyResponse(policy);
  }

  /**
   * Get all policies for tenant
   */
  async getPolicies(tenantId: string): Promise<PolicyResponseDto[]> {
    const policies = await this.policyRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });

    return policies.map(policy => this.mapToPolicyResponse(policy));
  }

  /**
   * Delete a policy
   */
  async deletePolicy(tenantId: string, policyId: string, userId: string): Promise<void> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId, tenantId },
    });

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    // Remove all policy assignments
    await this.policyAssignmentRepository.delete({ policyId });

    // Delete the policy
    await this.policyRepository.delete(policyId);

    // Emit policy deleted event
    this.eventEmitter.emit('policy.deleted', {
      tenantId,
      policyId,
      deletedBy: userId,
    });

    // Log audit event
    await this.auditLogService.log({
      tenantId,
      userId,
      action: 'policy.deleted',
      resourceType: 'policy',
      resourceId: policyId,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      oldValues: { name: policy.name }
    });
  }

  /**
   * Assign policy to user or role
   */
  async assignPolicy(
    tenantId: string,
    assignPolicyDto: AssignPolicyDto,
    userId: string,
  ): Promise<void> {
    const policy = await this.policyRepository.findOne({
      where: { id: assignPolicyDto.policyId, tenantId },
    });

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    // Check if assignment already exists
    const existingAssignment = await this.policyAssignmentRepository.findOne({
      where: {
        policyId: assignPolicyDto.policyId,
        assigneeType: assignPolicyDto.assigneeType,
        assigneeId: assignPolicyDto.assigneeId,
      },
    });

    if (existingAssignment) {
      throw new BadRequestException('Policy already assigned to this entity');
    }

    const assignment = this.policyAssignmentRepository.create({
      ...assignPolicyDto,
      tenantId,
      assignedBy: userId,
    });

    await this.policyAssignmentRepository.save(assignment);

    // Emit policy assigned event
    this.eventEmitter.emit('policy.assigned', {
      tenantId,
      policyId: assignPolicyDto.policyId,
      assigneeType: assignPolicyDto.assigneeType,
      assigneeId: assignPolicyDto.assigneeId,
      assignedBy: userId,
    });

    // Log audit event
    await this.auditLogService.log({
      tenantId,
      userId,
      action: 'policy.assigned',
      resourceType: 'policy_assignment',
      resourceId: assignment.id,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      newValues: {
        policyId: assignPolicyDto.policyId,
        assigneeType: assignPolicyDto.assigneeType,
        assigneeId: assignPolicyDto.assigneeId,
      }
    });
  }

  /**
   * Unassign policy from user or role
   */
  async unassignPolicy(
    tenantId: string,
    policyId: string,
    assigneeType: AssigneeType,
    assigneeId: string,
    userId: string,
  ): Promise<void> {
    const assignment = await this.policyAssignmentRepository.findOne({
      where: {
        policyId,
        assigneeType,
        assigneeId,
        tenantId,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Policy assignment not found');
    }

    await this.policyAssignmentRepository.delete(assignment.id);

    // Emit policy unassigned event
    this.eventEmitter.emit('policy.unassigned', {
      tenantId,
      policyId,
      assigneeType,
      assigneeId,
      unassignedBy: userId,
    });

    // Log audit event
    await this.auditLogService.log({
      tenantId,
      userId,
      action: 'policy.unassigned',
      resourceType: 'policy_assignment',
      resourceId: assignment.id,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      oldValues: { policyId, assigneeType, assigneeId }
    });
  }

  /**
   * Evaluate policies for a given context
   */
  async evaluatePolicies(context: PolicyEvaluationContext): Promise<PolicyEvaluationResult> {
    const { userId, tenantId, resource, action, resourceId, metadata } = context;

    // Get all policies assigned to the user (directly or through roles)
    const userAssignments = await this.policyAssignmentRepository.find({
      where: [
        { assigneeType: 'user', assigneeId: userId, tenantId },
        { assigneeType: 'role', assigneeId: In(await this.getUserRoles(userId, tenantId)), tenantId },
      ],
      relations: ['policy'],
    });

    const applicablePolicies = userAssignments
      .map(assignment => assignment.policy)
      .filter(policy => policy.status === 'active');

    let allowed = false;
    let reason = 'No applicable policies found';
    const appliedPolicies: string[] = [];

    for (const policy of applicablePolicies) {
      const policyResult = this.evaluatePolicy(policy, context);
      
      if (policyResult.applies) {
        appliedPolicies.push(policy.name);
        
        if (policy.effect === 'allow') {
          allowed = true;
          reason = `Allowed by policy: ${policy.name}`;
        } else if (policy.effect === 'deny') {
          // Deny policies override allow policies
          allowed = false;
          reason = `Denied by policy: ${policy.name}`;
          break; // Stop on first deny
        }
      }
    }

    // Log policy evaluation
    await this.auditLogService.log({
      tenantId,
      userId,
      action: 'policy.evaluated',
      resourceType: 'policy_evaluation',
      resourceId: `${resource}:${action}:${resourceId || 'any'}`,
      ipAddress: 'unknown',
      userAgent: 'unknown',
      newValues: {
        context,
        result: { allowed, reason, appliedPolicies },
      }
    });

    return { allowed, reason, appliedPolicies };
  }

  /**
   * Get roles assigned to a user
   * In a real implementation, this would query a roles/permissions service
   */
  private async getUserRoles(userId: string, tenantId: string): Promise<string[]> {
    // Mock implementation - in a real system, this would query a roles database
    // For now, we'll return an empty array since roles aren't fully implemented
    return [];
  }

  /**
   * Get policies assigned to a user
   */
  async getUserPolicies(tenantId: string, userId: string): Promise<PolicyResponseDto[]> {
    const assignments = await this.policyAssignmentRepository.find({
      where: { assigneeType: 'user', assigneeId: userId, tenantId },
      relations: ['policy'],
    });

    return assignments.map(assignment => this.mapToPolicyResponse(assignment.policy));
  }

  /**
   * Evaluate a single policy against the context
   */
  private evaluatePolicy(
    policy: Policy,
    context: PolicyEvaluationContext,
  ): { applies: boolean } {
    const { resource, action, resourceId, metadata } = context;

    // Check if policy applies to the resource
    if (policy.resources && policy.resources.length > 0) {
      const resourceMatches = policy.resources.some(policyResource =>
        this.matchesPattern(resource, policyResource),
      );
      if (!resourceMatches) {
        return { applies: false };
      }
    }

    // Check if policy applies to the action
    if (policy.actions && policy.actions.length > 0) {
      const actionMatches = policy.actions.some(policyAction =>
        this.matchesPattern(action, policyAction),
      );
      if (!actionMatches) {
        return { applies: false };
      }
    }

    // Evaluate conditions if any
    if (policy.conditions) {
      const conditionsMatch = this.evaluateConditions(policy.conditions, {
        resourceId,
        metadata,
      });
      if (!conditionsMatch) {
        return { applies: false };
      }
    }

    return { applies: true };
  }

  /**
   * Check if a value matches a pattern (supports wildcards)
   */
  private matchesPattern(value: string, pattern: string): boolean {
    if (pattern === '*') {
      return true;
    }

    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\\*/g, '.*'));
      return regex.test(value);
    }

    return value === pattern;
  }

  /**
   * Evaluate policy conditions
   */
  private evaluateConditions(conditions: any, context: any): boolean {
    // Simple condition evaluation - can be extended
    for (const [key, condition] of Object.entries(conditions)) {
      const value = this.getNestedValue(context, key);
      
      if (!this.evaluateCondition(value, condition)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(value: any, condition: any): boolean {
    if (typeof condition !== 'object') {
      return value === condition;
    }

    for (const [operator, expectedValue] of Object.entries(condition)) {
      switch (operator) {
        case 'eq':
          if (value !== expectedValue) return false;
          break;
        case 'ne':
          if (value === expectedValue) return false;
          break;
        case 'in':
          if (!Array.isArray(expectedValue) || !expectedValue.includes(value)) return false;
          break;
        case 'nin':
          if (Array.isArray(expectedValue) && expectedValue.includes(value)) return false;
          break;
        case 'gt':
          if (value <= expectedValue) return false;
          break;
        case 'gte':
          if (value < expectedValue) return false;
          break;
        case 'lt':
          if (value >= expectedValue) return false;
          break;
        case 'lte':
          if (value > expectedValue) return false;
          break;
        default:
          return false;
      }
    }

    return true;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Map policy entity to response DTO
   */
  private mapToPolicyResponse(policy: Policy): PolicyResponseDto {
    return {
      id: policy.id,
      name: policy.name,
      description: policy.description,
      type: policy.type,
      effect: policy.effect,
      resources: policy.resources,
      actions: policy.actions,
      conditions: policy.conditions,
      status: policy.status,
      priority: policy.priority,
      metadata: policy.metadata,
      createdBy: policy.createdBy,
      updatedBy: policy.updatedBy,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
    };
  }
}