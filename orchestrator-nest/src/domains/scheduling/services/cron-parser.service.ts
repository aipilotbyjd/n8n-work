import { Injectable, BadRequestException } from '@nestjs/common';
import * as cronParser from 'cron-parser';
import * as cronValidate from 'cron-validate';

export interface CronParseResult {
  isValid: boolean;
  nextRuns: Date[];
  description: string;
  fields: {
    second?: string;
    minute: string;
    hour: string;
    dayOfMonth: string;
    month: string;
    dayOfWeek: string;
  };
}

export interface CronValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
}

@Injectable()
export class CronParserService {
  /**
   * Parse and validate a cron expression
   */
  parseCronExpression(
    cronExpression: string,
    timezone?: string,
    nextRunsCount = 5,
  ): CronParseResult {
    try {
      // Validate cron expression
      const validation = this.validateCronExpression(cronExpression);
      if (!validation.isValid) {
        throw new BadRequestException(`Invalid cron expression: ${validation.error}`);
      }

      // Parse cron expression
      const options: any = {
        currentDate: new Date(),
        tz: timezone || 'UTC',
      };

      const interval = cronParser.parseExpression(cronExpression, options);
      
      // Get next execution times
      const nextRuns: Date[] = [];
      for (let i = 0; i < nextRunsCount; i++) {
        nextRuns.push(interval.next().toDate());
      }

      // Get human-readable description
      const description = this.getCronDescription(cronExpression);

      // Parse fields
      const fields = this.parseCronFields(cronExpression);

      return {
        isValid: true,
        nextRuns,
        description,
        fields,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to parse cron expression: ${error.message}`);
    }
  }

  /**
   * Validate a cron expression
   */
  validateCronExpression(cronExpression: string): CronValidationResult {
    try {
      // Basic validation
      const result = cronValidate(cronExpression);
      
      if (!result.isValid()) {
        return {
          isValid: false,
          error: result.getError().join(', '),
        };
      }

      // Additional custom validations
      const fields = cronExpression.split(' ');
      
      // Check for too frequent executions (every second)
      if (fields.length === 6 && fields[0] === '*') {
        return {
          isValid: true,
          warning: 'Cron expression runs every second. This may cause high system load.',
        };
      }

      // Check for very frequent executions (every minute)
      if (fields.length === 5 && fields[0] === '*' && fields[1] === '*') {
        return {
          isValid: true,
          warning: 'Cron expression runs every minute. Consider if this frequency is necessary.',
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error.message,
      };
    }
  }

  /**
   * Get the next execution time for a cron expression
   */
  getNextExecution(cronExpression: string, timezone?: string): Date {
    try {
      const options: any = {
        currentDate: new Date(),
        tz: timezone || 'UTC',
      };

      const interval = cronParser.parseExpression(cronExpression, options);
      return interval.next().toDate();
    } catch (error) {
      throw new BadRequestException(`Failed to get next execution: ${error.message}`);
    }
  }

  /**
   * Get multiple next execution times
   */
  getNextExecutions(
    cronExpression: string,
    count: number,
    timezone?: string,
  ): Date[] {
    try {
      const options: any = {
        currentDate: new Date(),
        tz: timezone || 'UTC',
      };

      const interval = cronParser.parseExpression(cronExpression, options);
      const executions: Date[] = [];
      
      for (let i = 0; i < count; i++) {
        executions.push(interval.next().toDate());
      }

      return executions;
    } catch (error) {
      throw new BadRequestException(`Failed to get next executions: ${error.message}`);
    }
  }

  /**
   * Check if a cron expression should run at a specific time
   */
  shouldRunAt(cronExpression: string, date: Date, timezone?: string): boolean {
    try {
      const options: any = {
        currentDate: new Date(date.getTime() - 1000), // 1 second before
        endDate: new Date(date.getTime() + 1000), // 1 second after
        tz: timezone || 'UTC',
      };

      const interval = cronParser.parseExpression(cronExpression, options);
      
      try {
        const next = interval.next().toDate();
        // Check if the next execution is within our time window
        return Math.abs(next.getTime() - date.getTime()) < 1000;
      } catch (iteratorError) {
        // No more executions in the time window
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Convert interval to cron expression
   */
  intervalToCron(intervalSeconds: number): string {
    if (intervalSeconds < 60) {
      // Every N seconds (requires 6-field cron)
      return `*/${intervalSeconds} * * * * *`;
    } else if (intervalSeconds < 3600) {
      // Every N minutes
      const minutes = Math.floor(intervalSeconds / 60);
      return `0 */${minutes} * * * *`;
    } else if (intervalSeconds < 86400) {
      // Every N hours
      const hours = Math.floor(intervalSeconds / 3600);
      return `0 0 */${hours} * * *`;
    } else {
      // Every N days
      const days = Math.floor(intervalSeconds / 86400);
      return `0 0 0 */${days} * *`;
    }
  }

  /**
   * Get human-readable description of cron expression
   */
  private getCronDescription(cronExpression: string): string {
    // This would integrate with a library like cronstrue for human-readable descriptions
    // For now, provide basic descriptions
    const fields = cronExpression.split(' ');
    
    if (fields.length === 5) {
      const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
      
      if (minute === '0' && hour === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        return 'Every day at midnight';
      }
      
      if (minute === '0' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        return `Every day at ${hour}:00`;
      }
      
      if (minute === '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        return 'Every minute';
      }
      
      if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        return `Every day at ${hour}:${minute.padStart(2, '0')}`;
      }
    }

    return `Cron expression: ${cronExpression}`;
  }

  /**
   * Parse cron fields into structured format
   */
  private parseCronFields(cronExpression: string): any {
    const fields = cronExpression.split(' ');
    
    if (fields.length === 5) {
      return {
        minute: fields[0],
        hour: fields[1],
        dayOfMonth: fields[2],
        month: fields[3],
        dayOfWeek: fields[4],
      };
    } else if (fields.length === 6) {
      return {
        second: fields[0],
        minute: fields[1],
        hour: fields[2],
        dayOfMonth: fields[3],
        month: fields[4],
        dayOfWeek: fields[5],
      };
    }

    throw new BadRequestException('Invalid cron expression format');
  }

  /**
   * Generate common cron expressions
   */
  getCommonCronExpressions(): Array<{ name: string; expression: string; description: string }> {
    return [
      {
        name: 'Every minute',
        expression: '* * * * *',
        description: 'Runs every minute',
      },
      {
        name: 'Every 5 minutes',
        expression: '*/5 * * * *',
        description: 'Runs every 5 minutes',
      },
      {
        name: 'Every 15 minutes',
        expression: '*/15 * * * *',
        description: 'Runs every 15 minutes',
      },
      {
        name: 'Every 30 minutes',
        expression: '*/30 * * * *',
        description: 'Runs every 30 minutes',
      },
      {
        name: 'Every hour',
        expression: '0 * * * *',
        description: 'Runs at the start of every hour',
      },
      {
        name: 'Every 6 hours',
        expression: '0 */6 * * *',
        description: 'Runs every 6 hours',
      },
      {
        name: 'Every 12 hours',
        expression: '0 */12 * * *',
        description: 'Runs every 12 hours (noon and midnight)',
      },
      {
        name: 'Daily at midnight',
        expression: '0 0 * * *',
        description: 'Runs every day at 00:00',
      },
      {
        name: 'Daily at 9 AM',
        expression: '0 9 * * *',
        description: 'Runs every day at 09:00',
      },
      {
        name: 'Weekdays at 9 AM',
        expression: '0 9 * * 1-5',
        description: 'Runs Monday to Friday at 09:00',
      },
      {
        name: 'Weekly on Monday',
        expression: '0 0 * * 1',
        description: 'Runs every Monday at midnight',
      },
      {
        name: 'Monthly on 1st',
        expression: '0 0 1 * *',
        description: 'Runs on the 1st day of every month at midnight',
      },
      {
        name: 'Quarterly',
        expression: '0 0 1 */3 *',
        description: 'Runs on the 1st day of every quarter at midnight',
      },
      {
        name: 'Yearly',
        expression: '0 0 1 1 *',
        description: 'Runs on January 1st at midnight',
      },
    ];
  }
}