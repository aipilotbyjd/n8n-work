import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CredentialsController } from './credentials.controller';
import { CredentialsService } from './credentials.service';
import { CredentialsRepository } from './credentials.repository';
import { CredentialEncryptionService } from './services/credential-encryption.service';
import { OAuthService } from './services/oauth.service';
import { CredentialValidationService } from './services/credential-validation.service';
import { Credential } from './entities/credential.entity';
import { CredentialType } from './entities/credential-type.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Credential, CredentialType]),
    EventEmitterModule,
    AuditModule,
  ],
  controllers: [CredentialsController],
  providers: [
    CredentialsService,
    CredentialsRepository,
    CredentialEncryptionService,
    OAuthService,
    CredentialValidationService,
  ],
  exports: [
    CredentialsService,
    CredentialEncryptionService,
    OAuthService,
    CredentialValidationService,
  ],
})
export class CredentialsModule {}
import { OAuthToken } from './entities/oauth-token.entity';
import { TenantsModule } from '../tenants/tenants.module';
import { ObservabilityModule } from '../../observability/observability.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Credential,
      CredentialType,
      OAuthToken,
    ]),
    TenantsModule,
    ObservabilityModule,
    AuditModule,
  ],
  controllers: [CredentialsController],
  providers: [
    CredentialsService,
    CredentialsRepository,
    CredentialEncryptionService,
    OAuthService,
    CredentialValidationService,
  ],
  exports: [
    CredentialsService,
    CredentialsRepository,
    CredentialEncryptionService,
  ],
})
export class CredentialsModule {}
