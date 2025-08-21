import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  incrementCounter(name: string, labels?: Record<string, string>): void {
    console.log(`METRIC: ${name}`, labels);
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    console.log(`GAUGE: ${name} = ${value}`, labels);
  }

  async query(query: string): Promise<any> {
    console.log(`QUERY: ${query}`);
    return { data: [] };
  }

  async getMetrics(): Promise<string> {
    return '# N8N-Work Metrics\n# TODO: Implement proper metrics collection\n';
  }
}