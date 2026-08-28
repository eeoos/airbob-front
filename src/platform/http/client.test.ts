import axios from "axios";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { client as legacyClient } from "../../api/client";
import { onAuthError } from "../../utils/authEvents";
import { getHttpClient, httpClient } from "./client";

const successfulResponse = (
  config: InternalAxiosRequestConfig,
): AxiosResponse => ({
  config,
  data: { success: true, data: null, error: null },
  headers: {},
  status: 200,
  statusText: "OK",
});

describe("platform HTTP client", () => {
  it("constructs the singleton with the actual browser Axios factory in Jest", () => {
    expect(typeof axios).toBe("function");
    expect(typeof axios.create).toBe("function");
    expect(typeof axios.VERSION).toBe("string");
    expect(httpClient).not.toBe(axios);
    expect(typeof httpClient.request).toBe("function");
  });

  it("is the same singleton exposed by the legacy facade", () => {
    expect(getHttpClient()).toBe(httpClient);
    expect(legacyClient).toBe(httpClient);
  });

  it("preserves the current credentials, JSON header, base URL, and no-timeout defaults", () => {
    expect(httpClient.defaults.baseURL).toBe("http://localhost:8080/api/v1");
    expect(httpClient.defaults.withCredentials).toBe(true);
    expect(httpClient.defaults.headers["Content-Type"]).toBe("application/json");
    expect(httpClient.defaults.timeout).toBe(0);
  });

  it("passes an AbortSignal through by identity", async () => {
    const controller = new AbortController();
    let capturedSignal: unknown;

    await httpClient.get("/abort-contract", {
      signal: controller.signal,
      adapter: async (config) => {
        capturedSignal = config.signal;
        return successfulResponse(config);
      },
    });

    expect(capturedSignal).toBe(controller.signal);
  });

  it("keeps a non-authentication transport failure unchanged for legacy callers", async () => {
    const rawError = new Error("network failure");
    let thrownError: unknown;

    try {
      await legacyClient.get("/raw-error-contract", {
        adapter: async () => Promise.reject(rawError),
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBe(rawError);
  });

  it("publishes raw 401 and M004 failures while preserving their identity", async () => {
    jest.useFakeTimers();
    const listener = jest.fn();
    const unsubscribe = onAuthError(listener);
    const failures = [
      {
        isAxiosError: true,
        response: { status: 401, data: null },
      },
      {
        isAxiosError: true,
        response: {
          status: 403,
          data: { success: false, error: { code: "M004" } },
        },
      },
    ];

    try {
      for (const failure of failures) {
        let thrownError: unknown;

        try {
          await legacyClient.get("/auth-error-contract", {
            adapter: async () => Promise.reject(failure),
          });
        } catch (error) {
          thrownError = error;
        }

        expect(thrownError).toBe(failure);
        jest.advanceTimersByTime(1000);
      }

      expect(listener).toHaveBeenCalledTimes(2);
    } finally {
      unsubscribe();
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    }
  });

  it.each([
    { error: { code: "M004" } },
    { success: true, data: null, error: { code: "M004" } },
  ])(
    "does not publish an auth event for M004 outside a failure envelope (%p)",
    async (data) => {
      jest.useFakeTimers();
      const listener = jest.fn();
      const unsubscribe = onAuthError(listener);
      const failure = {
        isAxiosError: true,
        response: { status: 403, data },
      };

      try {
        let thrownError: unknown;

        try {
          await legacyClient.get("/untrusted-auth-code-contract", {
            adapter: async () => Promise.reject(failure),
          });
        } catch (error) {
          thrownError = error;
        }

        expect(thrownError).toBe(failure);
        expect(listener).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
      }
    },
  );
});
