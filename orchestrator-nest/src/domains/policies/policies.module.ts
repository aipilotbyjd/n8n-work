import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { PoliciesController } from "./policies.controller";
import { PoliciesService } from "./policies.service";
import { Policy } from "./entities/policy.entity";
import { PolicyAssignment } from "./entities/policy-assignment.entity";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Policy, PolicyAssignment]),
    EventEmitterModule,
    AuditModule,
  ],
  controllers: [PoliciesController],
  providers: [PoliciesService],
  exports: [PoliciesService],
})
export class PoliciesModule {}
