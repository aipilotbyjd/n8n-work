// OpenTelemetry tracing setup - simplified for now
// TODO: Add proper OpenTelemetry integration

let isInitialized = false;

export function initializeOpenTelemetry(): void {
  if (isInitialized) {
    return;
  }

  console.log('OpenTelemetry tracing initialization skipped - not configured');
  isInitialized = true;
}