import { Injectable } from '@nestjs/common';

@Injectable()
export class AlertingService {
  async sendAlert(alert: any): Promise<void> {
    // Send alert notification
    console.log('ALERT:', alert);
  }

  async sendSLOAlert(sloName: string, status: string, details: any): Promise<void> {
    await this.sendAlert({
      type: 'SLO_VIOLATION',
      slo: sloName,
      status,
      details,
      timestamp: new Date()
    });
  }
}