// OpenTelemetry tracing setup - simplified for now

let isInitialized = false;

export function initializeOpenTelemetry(): void {
  if (isInitialized) {
    return;
  }

  console.log("OpenTelemetry tracing initialization skipped - not configured");
  isInitialized = true;
}
