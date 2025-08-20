import { NodeBase } from './NodeBase';
import {
  IExecutionContext,
  IWorkflowData,
  INodeExecutionData,
  JsonObject,
} from '@/types';

/**
 * Base class for trigger nodes (webhook, polling, etc.)
 */
export abstract class TriggerNode extends NodeBase {
  /**
   * Default execution method for trigger nodes
   * Triggers typically don't execute in the traditional sense
   */
  public async execute(
    context: IExecutionContext,
    data: IWorkflowData
  ): Promise<INodeExecutionData[]> {
    throw new Error('Trigger nodes should not be executed directly. Use poll() or webhook() methods.');
  }

  /**
   * Abstract polling method that must be implemented by trigger nodes
   */
  public abstract poll(
    context: IExecutionContext,
    data: IWorkflowData
  ): Promise<INodeExecutionData[]>;

  /**
   * Abstract webhook method that may be implemented by webhook trigger nodes
   */
  public webhook?(
    context: IExecutionContext,
    data: IWorkflowData
  ): Promise<INodeExecutionData[]>;

  /**
   * Helper method to check if data has changed since last execution
   */
  protected hasDataChanged(
    currentData: JsonObject,
    lastData: JsonObject | null,
    trackingField: string = 'id'
  ): boolean {
    if (!lastData) {
      return true;
    }

    const currentValue = currentData[trackingField];
    const lastValue = lastData[trackingField];

    return currentValue !== lastValue;
  }

  /**
   * Helper method to filter new items since last execution
   */
  protected filterNewItems(
    items: JsonObject[],
    lastExecutionData: JsonObject | null,
    trackingField: string = 'id'
  ): JsonObject[] {
    if (!lastExecutionData || !lastExecutionData[trackingField]) {
      return items;
    }

    const lastValue = lastExecutionData[trackingField];
    
    return items.filter(item => {
      const itemValue = item[trackingField];
      
      // For string/number comparison
      if (typeof itemValue === 'string' || typeof itemValue === 'number') {
        return itemValue > lastValue;
      }
      
      // For date comparison
      if (itemValue instanceof Date || typeof itemValue === 'string') {
        const itemDate = new Date(itemValue);
        const lastDate = new Date(lastValue);
        return itemDate > lastDate;
      }
      
      return false;
    });
  }

  /**
   * Helper method to create tracking data for next execution
   */
  protected createTrackingData(
    items: JsonObject[],
    trackingField: string = 'id'
  ): JsonObject {
    if (items.length === 0) {
      return {};
    }

    // Find the latest item based on tracking field
    const latestItem = items.reduce((latest, current) => {
      const currentValue = current[trackingField];
      const latestValue = latest[trackingField];

      if (!latestValue) {
        return current;
      }

      // For string/number comparison
      if (typeof currentValue === 'string' || typeof currentValue === 'number') {
        return currentValue > latestValue ? current : latest;
      }

      // For date comparison
      if (currentValue instanceof Date || typeof currentValue === 'string') {
        const currentDate = new Date(currentValue);
        const latestDate = new Date(latestValue);
        return currentDate > latestDate ? current : latest;
      }

      return latest;
    });

    return {
      [trackingField]: latestItem[trackingField],
      lastExecutionTime: new Date().toISOString(),
    };
  }

  /**
   * Helper method to handle rate limiting for API calls
   */
  protected async handleRateLimit(
    rateLimitPerMinute: number,
    lastCallTime?: Date
  ): Promise<void> {
    if (!lastCallTime) {
      return;
    }

    const minInterval = 60000 / rateLimitPerMinute; // Minimum interval in ms
    const timeSinceLastCall = Date.now() - lastCallTime.getTime();

    if (timeSinceLastCall < minInterval) {
      const waitTime = minInterval - timeSinceLastCall;
      await this.sleep(waitTime);
    }
  }

  /**
   * Helper method to validate webhook signature
   */
  protected validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
    algorithm: string = 'sha256'
  ): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Helper method to parse webhook headers for useful information
   */
  protected parseWebhookHeaders(headers: Record<string, string>): JsonObject {
    const parsedHeaders: JsonObject = {};

    // Common webhook headers
    const webhookHeaders = [
      'x-github-event',
      'x-hub-signature',
      'x-hub-signature-256',
      'x-slack-signature',
      'x-slack-request-timestamp',
      'user-agent',
      'content-type',
      'x-forwarded-for',
      'x-real-ip',
    ];

    webhookHeaders.forEach(header => {
      const value = headers[header] || headers[header.toLowerCase()];
      if (value) {
        parsedHeaders[header] = value;
      }
    });

    return parsedHeaders;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
