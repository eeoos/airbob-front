/**
 * Synthetic origins owned by the deterministic browser harness.
 *
 * The API hostname deliberately uses the reserved `.invalid` TLD so a missed
 * interception cannot reach a real service.
 */
export const E2E_APP_ORIGIN = "http://127.0.0.1:4173";
export const E2E_API_ORIGIN = "https://api.airbob-e2e.invalid";
