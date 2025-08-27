import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { PoliciesService } from "./policies.service";
import {
  CreatePolicyDto,
  UpdatePolicyDto,
  AssignPolicyDto,
  PolicyResponseDto,
  PolicyEvaluationRequestDto,
  PolicyEvaluationResponseDto,
} from "./dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { TenantGuard } from "../../auth/guards/tenant.guard";
import { GetCurrentUser } from "../../auth/decorators/get-current-user.decorator";
import { GetCurrentTenant } from "../../auth/decorators/get-current-tenant.decorator";

@ApiTags("policies")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller("policies")
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Post()
  @ApiOperation({ summary: "Create a new policy" })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Policy created successfully",
    type: PolicyResponseDto,
  })
  async createPolicy(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser("id") userId: string,
    @Body() createPolicyDto: CreatePolicyDto,
  ): Promise<PolicyResponseDto> {
    return this.policiesService.createPolicy(tenantId, createPolicyDto, userId);
  }

  @Put(":policyId")
  @ApiOperation({ summary: "Update an existing policy" })
  @ApiParam({
    name: "policyId",
    description: "Policy ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Policy updated successfully",
    type: PolicyResponseDto,
  })
  async updatePolicy(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser("id") userId: string,
    @Param("policyId") policyId: string,
    @Body() updatePolicyDto: UpdatePolicyDto,
  ): Promise<PolicyResponseDto> {
    return this.policiesService.updatePolicy(
      tenantId,
      policyId,
      updatePolicyDto,
      userId,
    );
  }

  @Get(":policyId")
  @ApiOperation({ summary: "Get policy by ID" })
  @ApiParam({
    name: "policyId",
    description: "Policy ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Returns policy details",
    type: PolicyResponseDto,
  })
  async getPolicy(
    @GetCurrentTenant() tenantId: string,
    @Param("policyId") policyId: string,
  ): Promise<PolicyResponseDto> {
    return this.policiesService.getPolicy(tenantId, policyId);
  }

  @Get()
  @ApiOperation({ summary: "Get all policies for tenant" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Returns all policies",
    type: [PolicyResponseDto],
  })
  async getPolicies(
    @GetCurrentTenant() tenantId: string,
  ): Promise<PolicyResponseDto[]> {
    return this.policiesService.getPolicies(tenantId);
  }

  @Delete(":policyId")
  @ApiOperation({ summary: "Delete a policy" })
  @ApiParam({
    name: "policyId",
    description: "Policy ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "Policy deleted successfully",
  })
  async deletePolicy(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser("id") userId: string,
    @Param("policyId") policyId: string,
  ): Promise<void> {
    return this.policiesService.deletePolicy(tenantId, policyId, userId);
  }

  @Post("assignments")
  @ApiOperation({ summary: "Assign policy to user, role, or group" })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Policy assigned successfully",
  })
  async assignPolicy(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser("id") userId: string,
    @Body() assignPolicyDto: AssignPolicyDto,
  ): Promise<void> {
    return this.policiesService.assignPolicy(tenantId, assignPolicyDto, userId);
  }

  @Delete("assignments/:policyId/:assigneeType/:assigneeId")
  @ApiOperation({ summary: "Unassign policy from user, role, or group" })
  @ApiParam({
    name: "policyId",
    description: "Policy ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiParam({
    name: "assigneeType",
    description: "Type of assignee",
    enum: ["user", "role", "group"],
    example: "user",
  })
  @ApiParam({
    name: "assigneeId",
    description: "Assignee ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "Policy unassigned successfully",
  })
  async unassignPolicy(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser("id") userId: string,
    @Param("policyId") policyId: string,
    @Param("assigneeType") assigneeType: string,
    @Param("assigneeId") assigneeId: string,
  ): Promise<void> {
    return this.policiesService.unassignPolicy(
      tenantId,
      policyId,
      assigneeType,
      assigneeId,
      userId,
    );
  }

  @Post("evaluate")
  @ApiOperation({ summary: "Evaluate policies for a given context" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Returns policy evaluation result",
    type: PolicyEvaluationResponseDto,
  })
  async evaluatePolicies(
    @GetCurrentTenant() tenantId: string,
    @GetCurrentUser("id") userId: string,
    @Body() evaluationRequest: PolicyEvaluationRequestDto,
  ): Promise<PolicyEvaluationResponseDto> {
    const context = {
      userId,
      tenantId,
      ...evaluationRequest,
    };

    return this.policiesService.evaluatePolicies(context);
  }
}
