import type { AxiosAdapter } from "axios";
import { onAuthError } from "../utils/authEvents";
import { authApi } from "./auth";
import { isSessionOwnedAuthEventRequest } from "./authEventPolicy";
import { client } from "./client";

const sessionCalls = [
  {
    name: "getMe",
    invoke: () => authApi.getMe(),
  },
  {
    name: "login",
    invoke: () =>
      authApi.login({ email: "guest@example.com", password: "password" }),
  },
  {
    name: "logout",
    invoke: () => authApi.logout(),
  },
] as const;

describe("session-owned auth event policy", () => {
  const originalAdapter = client.defaults.adapter;

  afterEach(() => {
    client.defaults.adapter = originalAdapter;
  });

  it.each(sessionCalls)(
    "suppresses raw 401 and M004 events for $name while preserving the error",
    async ({ invoke }) => {
      const listener = jest.fn();
      const unsubscribe = onAuthError(listener);
      const failures = [
        {
          status: 401,
          data: null,
        },
        {
          status: 403,
          data: {
            success: false,
            data: null,
            error: { code: "M004" },
          },
        },
      ];

      try {
        for (const response of failures) {
          let rawFailure: unknown;
          const adapter: AxiosAdapter = async (config) => {
            expect(isSessionOwnedAuthEventRequest(config)).toBe(true);
            rawFailure = {
              isAxiosError: true,
              config,
              response,
            };
            throw rawFailure;
          };
          client.defaults.adapter = adapter;

          let thrownError: unknown;
          try {
            await invoke();
          } catch (error) {
            thrownError = error;
          }

          expect(thrownError).toBe(rawFailure);
        }

        expect(listener).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
      }
    },
  );

  it.each(sessionCalls)(
    "suppresses unsuccessful M004 envelope events for $name while preserving ApiClientError",
    async ({ invoke }) => {
      const listener = jest.fn();
      const unsubscribe = onAuthError(listener);
      const adapter: AxiosAdapter = async (config) => ({
        config,
        data: {
          success: false,
          data: null,
          error: {
            message: "세션이 만료되었습니다.",
            status: 403,
            code: "M004",
          },
        },
        headers: {
          "content-type": "application/json;charset=utf-8",
        },
        status: 200,
        statusText: "OK",
      });
      client.defaults.adapter = adapter;

      try {
        await expect(invoke()).rejects.toMatchObject({
          name: "ApiClientError",
          code: "M004",
          status: 403,
        });
        expect(listener).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
      }
    },
  );

  it("keeps an unrelated raw authentication failure on the global event path", async () => {
    const listener = jest.fn();
    const unsubscribe = onAuthError(listener);
    let rawFailure: unknown;
    const adapter: AxiosAdapter = async (config) => {
      expect(isSessionOwnedAuthEventRequest(config)).toBe(false);
      rawFailure = {
        isAxiosError: true,
        config,
        response: {
          status: 401,
          data: null,
        },
      };
      throw rawFailure;
    };
    client.defaults.adapter = adapter;

    try {
      let thrownError: unknown;
      try {
        await client.get("/unrelated-auth-failure");
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).toBe(rawFailure);
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });
});
