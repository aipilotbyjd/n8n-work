import { Module } from '@nestjs/common';
import { CredentialsController } from './credentials.controller';

@Module({
  controllers: [CredentialsController],
  providers: [],
  exports: [],
})
export class CredentialsModule {}
