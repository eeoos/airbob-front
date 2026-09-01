import type { Page } from "@playwright/test";

export type SyntheticPaymentResult =
  | { outcome: "resolve"; deferPreparation?: boolean }
  | {
      outcome: "reject";
      code: string;
      message: string;
      deferPreparation?: boolean;
    };

export interface PaymentGatewayCall {
  kind: "client" | "destroy" | "payment" | "request-payment";
  payload: unknown;
}

export const installPaymentGatewayFixture = async (
  page: Page,
  result: SyntheticPaymentResult = { outcome: "resolve" },
): Promise<void> => {
  await page.addInitScript((configuredResult) => {
    const calls: Array<{ kind: string; payload: unknown }> = [];
    const redactSensitivePayload = (payload: unknown): unknown => {
      if (Array.isArray(payload)) {
        return payload.map(redactSensitivePayload);
      }

      if (typeof payload !== "object" || payload === null) {
        return payload;
      }

      return Object.fromEntries(
        Object.entries(payload).map(([key, value]) => [
          key,
          /(?:email|id|key|name|password|secret|token|uid|url)/i.test(key)
            ? "[redacted]"
            : redactSensitivePayload(value),
        ]),
      );
    };

    Object.defineProperty(window, "__AIRBOB_PAYMENT_CALLS__", {
      configurable: true,
      value: calls,
    });

    Object.defineProperty(window, "TossPayments", {
      configurable: true,
      value: (clientKey: string) => {
        if (!clientKey.startsWith("test_ck_")) {
          throw new Error("E2E payment fixture requires a synthetic test key.");
        }

        calls.push({
          kind: "client",
          payload: redactSensitivePayload({ clientKey }),
        });

        const client = {
          payment: (options: unknown) => {
            calls.push({
              kind: "payment",
              payload: redactSensitivePayload(options),
            });

            return {
              destroy: async () => {
                calls.push({ kind: "destroy", payload: null });
              },
              requestPayment: async (payload: unknown) => {
                calls.push({
                  kind: "request-payment",
                  payload: redactSensitivePayload(payload),
                });

                if (configuredResult.outcome === "reject") {
                  const paymentError = new Error(
                    configuredResult.message,
                  ) as Error & { code: string };
                  paymentError.code = configuredResult.code;
                  throw paymentError;
                }
              },
            };
          },
        };

        if (!configuredResult.deferPreparation) return client;

        return new Promise<typeof client>((resolve) => {
          Object.defineProperty(
            window,
            "__AIRBOB_RELEASE_PAYMENT_PREPARATION__",
            {
              configurable: true,
              value: () => {
                delete (
                  window as typeof window & {
                    __AIRBOB_RELEASE_PAYMENT_PREPARATION__?: () => void;
                  }
                ).__AIRBOB_RELEASE_PAYMENT_PREPARATION__;
                resolve(client);
              },
            },
          );
        });
      },
    });
  }, result);
};

export const releasePaymentGatewayPreparation = async (
  page: Page,
): Promise<void> => {
  await page.waitForFunction(
    () =>
      typeof (
        window as typeof window & {
          __AIRBOB_RELEASE_PAYMENT_PREPARATION__?: () => void;
        }
      ).__AIRBOB_RELEASE_PAYMENT_PREPARATION__ === "function",
  );
  await page.evaluate(() => {
    const syntheticWindow = window as typeof window & {
      __AIRBOB_RELEASE_PAYMENT_PREPARATION__?: () => void;
    };
    syntheticWindow.__AIRBOB_RELEASE_PAYMENT_PREPARATION__?.();
  });
};

export const readPaymentGatewayCalls = async (
  page: Page,
): Promise<PaymentGatewayCall[]> =>
  page.evaluate(() => {
    const syntheticWindow = window as typeof window & {
      __AIRBOB_PAYMENT_CALLS__?: PaymentGatewayCall[];
    };

    return syntheticWindow.__AIRBOB_PAYMENT_CALLS__ ?? [];
  });
