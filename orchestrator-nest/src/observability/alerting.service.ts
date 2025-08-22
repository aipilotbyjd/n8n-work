import { Injectable } from '@nestjs/common';

@Injectable()
export class AlertingService {
  async sendAlert(channel: string, alert: any): Promise<void> {
    // Send alert notification to specific channel
    console.log(`ALERT [${channel}]:`, alert);
  }

  async resolveAlert(channel: string, alert: any): Promise<void> {
    // Send alert resolution notification to specific channel
    console.log(`ALERT RESOLVED [${channel}]:`, alert);
  }

  async sendSLOAlert(sloName: string, status: string, details: any): Promise<void> {
    await this.sendAlert('default', {
      type: 'SLO_VIOLATION',
      slo: sloName,
      status,
      details,
      timestamp: new Date()
    });
  }
}