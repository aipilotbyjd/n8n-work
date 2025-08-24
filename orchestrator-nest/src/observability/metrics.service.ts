import { Injectable } from '@nestjs/common';
import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, Counter<string>>();
  private readonly histograms = new Map<string, Histogram<string>>();
  private readonly gauges = new Map<string, Gauge<string>>();

  constructor() {
    // Collect default metrics (CPU, memory, etc.)
    collectDefaultMetrics({ register });
  }

  incrementCounter(name: string, labels?: Record<string, string>): void {
    let counter = this.counters.get(name);
    if (!counter) {
      counter = new Counter({
        name,
        help: `Counter for ${name}`,
        labelNames: labels ? Object.keys(labels) : [],
        registers: [register]
      });
      this.counters.set(name, counter);
    }
    
    if (labels) {
      counter.inc(labels);
    } else {
      counter.inc();
    }
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    let gauge = this.gauges.get(name);
    if (!gauge) {
      gauge = new Gauge({
        name,
        help: `Gauge for ${name}`,
        labelNames: labels ? Object.keys(labels) : [],
        registers: [register]
      });
      this.gauges.set(name, gauge);
    }
    
    if (labels) {
      gauge.set(labels, value);
    } else {
      gauge.set(value);
    }
  }

  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    let histogram = this.histograms.get(name);
    if (!histogram) {
      histogram = new Histogram({
        name,
        help: `Histogram for ${name}`,
        labelNames: labels ? Object.keys(labels) : [],
        registers: [register]
      });
      this.histograms.set(name, histogram);
    }
    
    if (labels) {
      histogram.observe(labels, value);
    } else {
      histogram.observe(value);
    }
  }

  async query(query: string): Promise<any> {
    // This would integrate with Prometheus query API
    // For now, return metrics from the registry
    const metrics = await register.metrics();
    return { data: metrics };
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}