import { AppError } from "../http/errors";

export type IntegrationName =
  | "daum-postcode"
  | "google-maps"
  | "google-places"
  | "toss-payments-v2";

export type IntegrationErrorCode =
  | "INTEGRATION_DISCONNECTED"
  | "INTEGRATION_INVALID_RUNTIME"
  | "INTEGRATION_LOAD_FAILED"
  | "INTEGRATION_MISSING_CONFIG"
  | "INTEGRATION_TIMEOUT"
  | "INTEGRATION_UNAVAILABLE";

interface IntegrationErrorOptions {
  code: IntegrationErrorCode;
  integration: IntegrationName;
  message: string;
  retryable: boolean;
}

/**
 * A deliberately small, safe error boundary for browser SDKs.
 *
 * Do not add URLs, keys, provider payloads, or provider error objects here. A
 * caller may report the code and integration name without leaking browser
 * configuration or customer data.
 */
export class IntegrationError extends AppError {
  readonly integration: IntegrationName;

  constructor({
    code,
    integration,
    message,
    retryable,
  }: IntegrationErrorOptions) {
    super({
      kind: "integration",
      code,
      message,
      retryable,
    });
    this.name = "IntegrationError";
    this.integration = integration;
    Object.setPrototypeOf(this, IntegrationError.prototype);
  }
}
