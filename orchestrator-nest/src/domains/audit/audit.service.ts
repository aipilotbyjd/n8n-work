import { Injectable } from '@nestjs/common';

@Injectable()
export class AuditService {
  async log(logEntry: any): Promise<void> {
    // TODO: implement
  }
}
