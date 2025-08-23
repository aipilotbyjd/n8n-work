import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  ParseBoolPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Tenant } from '../../common/decorators/tenant.decorator';
import { CredentialsService } from './credentials.service';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { UpdateCredentialDto } from './dto/update-credential.dto';
import { CredentialResponseDto, CredentialTypeResponseDto } from './dto/credential-response.dto';
import { OAuthCallbackDto, StartOAuthDto, OAuthUrlResponseDto } from './dto/oauth-callback.dto';

@ApiTags('Credentials')
@Controller('credentials')
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth('JWT-auth')
export class CredentialsController {
  constructor(private readonly credentialsService: CredentialsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new credential',
    description: 'Creates a new credential with encrypted storage of sensitive data.',
  })
  @ApiCreatedResponse({
    description: 'Credential created successfully',
    type: CredentialResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid credential data or validation failed' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async create(
    @Body() createCredentialDto: CreateCredentialDto,
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ): Promise<CredentialResponseDto> {
    return this.credentialsService.create(createCredentialDto, tenantId, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all credentials for the tenant',
    description: 'Retrieves all credentials belonging to the current tenant.',
  })
  @ApiQuery({
    name: 'includeData',
    required: false,
    type: Boolean,
    description: 'Include decrypted credential data in response (requires admin permissions)',
    example: false,
  })
  @ApiOkResponse({
    description: 'List of credentials',
    type: [CredentialResponseDto],
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async findAll(
    @Tenant() tenantId: string,
    @Query('includeData', new DefaultValuePipe(false), ParseBoolPipe)
    includeData: boolean = false,
  ): Promise<CredentialResponseDto[]> {
    return this.credentialsService.findAll(tenantId, includeData);
  }

  @Get('types')
  @ApiOperation({
    summary: 'Get available credential types',
    description: 'Retrieves all available credential types that can be used to create credentials.',
  })
  @ApiOkResponse({
    description: 'List of available credential types',
    type: [CredentialTypeResponseDto],
  })
  async getCredentialTypes() {
    return this.credentialsService.getCredentialTypes();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a credential by ID',
    description: 'Retrieves a specific credential by its ID.',
  })
  @ApiParam({ name: 'id', description: 'Credential UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiQuery({
    name: 'includeData',
    required: false,
    type: Boolean,
    description: 'Include decrypted credential data in response',
    example: false,
  })
  @ApiOkResponse({
    description: 'Credential details',
    type: CredentialResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Credential not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async findOne(
    @Param('id') id: string,
    @Tenant() tenantId: string,
    @Query('includeData', new DefaultValuePipe(false), ParseBoolPipe)
    includeData: boolean = false,
  ): Promise<CredentialResponseDto> {
    return this.credentialsService.findOne(id, tenantId, includeData);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a credential',
    description: 'Updates an existing credential. Only provided fields will be updated.',
  })
  @ApiParam({ name: 'id', description: 'Credential UUID' })
  @ApiOkResponse({
    description: 'Credential updated successfully',
    type: CredentialResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid update data or validation failed' })
  @ApiNotFoundResponse({ description: 'Credential not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async update(
    @Param('id') id: string,
    @Body() updateCredentialDto: UpdateCredentialDto,
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ): Promise<CredentialResponseDto> {
    return this.credentialsService.update(id, updateCredentialDto, tenantId, user.id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a credential',
    description: 'Permanently deletes a credential and all associated data.',
  })
  @ApiParam({ name: 'id', description: 'Credential UUID' })
  @ApiNoContentResponse({ description: 'Credential deleted successfully' })
  @ApiNotFoundResponse({ description: 'Credential not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Tenant() tenantId: string,
  ): Promise<void> {
    return this.credentialsService.remove(id, tenantId, user.id);
  }

  @Post(':id/test')
  @ApiOperation({
    summary: 'Test a credential connection',
    description: 'Tests whether the credential can successfully authenticate with its target service.',
  })
  @ApiParam({ name: 'id', description: 'Credential UUID' })
  @ApiOkResponse({
    description: 'Credential test result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', description: 'Whether the test was successful' },
        message: { type: 'string', description: 'Test result message' },
      },
      required: ['success'],
    },
  })
  @ApiNotFoundResponse({ description: 'Credential not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async testCredential(
    @Param('id') id: string,
    @Tenant() tenantId: string,
  ): Promise<{ success: boolean; message?: string }> {
    return this.credentialsService.test(id, tenantId);
  }

  @Post(':id/oauth/start')
  @ApiOperation({
    summary: 'Start OAuth flow for a credential',
    description: 'Initiates an OAuth 2.0 authorization flow for the specified credential.',
  })
  @ApiParam({ name: 'id', description: 'Credential UUID' })
  @ApiOkResponse({
    description: 'OAuth authorization URL and state',
    type: OAuthUrlResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Credential does not support OAuth or invalid request' })
  @ApiNotFoundResponse({ description: 'Credential not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async startOAuth(
    @Param('id') id: string,
    @Tenant() tenantId: string,
    @Body() body: { redirectUrl?: string },
  ): Promise<OAuthUrlResponseDto> {
    return this.credentialsService.startOAuthFlow(id, tenantId, body.redirectUrl);
  }

  @Post('oauth/callback')
  @ApiOperation({
    summary: 'Complete OAuth flow',
    description: 'Completes the OAuth 2.0 flow by exchanging the authorization code for access tokens.',
  })
  @ApiOkResponse({
    description: 'OAuth flow completed successfully',
    type: CredentialResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid OAuth callback data or expired state' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async oauthCallback(
    @Body() oauthCallbackDto: OAuthCallbackDto,
    @Tenant() tenantId: string,
  ): Promise<CredentialResponseDto> {
    if (oauthCallbackDto.error) {
      throw new Error(`OAuth error: ${oauthCallbackDto.error_description || oauthCallbackDto.error}`);
    }
    return this.credentialsService.completeOAuthFlow(
      oauthCallbackDto.state,
      oauthCallbackDto.code,
      tenantId,
    );
  }

  @Post(':id/oauth/refresh')
  @ApiOperation({
    summary: 'Refresh OAuth token',
    description: 'Refreshes the OAuth access token using the stored refresh token.',
  })
  @ApiParam({ name: 'id', description: 'Credential UUID' })
  @ApiOkResponse({
    description: 'OAuth token refreshed successfully',
    type: CredentialResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Unable to refresh token or token not found' })
  @ApiNotFoundResponse({ description: 'Credential not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async refreshOAuthToken(
    @Param('id') id: string,
    @Tenant() tenantId: string,
  ): Promise<CredentialResponseDto> {
    return this.credentialsService.refreshOAuthToken(id, tenantId);
  }
}