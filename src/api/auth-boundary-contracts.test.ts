import * as fs from "fs";
import * as path from "path";
import { ErrorResponse } from "../types/api";
import { MeInfo } from "../types/auth";
import { onAuthError } from "../utils/authEvents";
import { authApi } from "./auth";
import { sessionOwnedAuthEventPolicy } from "./authEventPolicy";
import { client } from "./client";
import { ApiClientError } from "./response";

jest.mock("axios", () => ({
  AxiosError: class AxiosError extends Error {
    readonly code?: string;
    readonly response?: unknown;

    constructor(
      message?: string,
      code?: string,
      _config?: unknown,
      _request?: unknown,
      response?: unknown
    ) {
      super(message);
      this.name = "AxiosError";
      this.code = code;
      this.response = response;
    }
  },
}));

jest.mock("./client", () => ({
  client: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const readSource = (...segments: string[]) =>
  fs.readFileSync(path.join(__dirname, ...segments), "utf8");

describe("auth boundary contracts", () => {
  const mockClientGet = client.get as jest.Mock;
  const mockClientPost = client.post as jest.Mock;

  beforeEach(() => {
    mockClientGet.mockReset();
    mockClientPost.mockReset();
  });

  it("returns MeInfo from a successful getMe envelope", async () => {
    const meInfo: MeInfo = {
      id: 1,
      email: "guest@example.com",
      nickname: "Guest",
      thumbnail_image_url: null,
    };

    mockClientGet.mockResolvedValue({
      data: {
        success: true,
        data: meInfo,
        error: null,
      },
      headers: {
        "content-type": "application/json;charset=utf-8",
      },
    });

    await expect(authApi.getMe()).resolves.toEqual(meInfo);
    expect(mockClientGet).toHaveBeenCalledWith(
      "/auth/me",
      sessionOwnedAuthEventPolicy,
    );
  });

  it("passes an AbortSignal through to the getMe request when provided", async () => {
    const meInfo: MeInfo = {
      id: 1,
      email: "guest@example.com",
      nickname: "Guest",
      thumbnail_image_url: null,
    };
    const controller = new AbortController();

    mockClientGet.mockResolvedValue({
      data: {
        success: true,
        data: meInfo,
        error: null,
      },
      headers: {
        "content-type": "application/json;charset=utf-8",
      },
    });

    await expect(authApi.getMe(controller.signal)).resolves.toEqual(meInfo);
    expect(mockClientGet).toHaveBeenCalledWith("/auth/me", {
      ...sessionOwnedAuthEventPolicy,
      signal: controller.signal,
    });
  });

  it("marks login and logout as session-owned without putting policy in transport data", async () => {
    const controller = new AbortController();
    const credentials = {
      email: "guest@example.com",
      password: "password",
    };
    const successEnvelope = {
      data: {
        success: true,
        data: null,
        error: null,
      },
    };

    mockClientPost.mockResolvedValue(successEnvelope);

    await expect(authApi.login(credentials, controller.signal)).resolves.toBeUndefined();
    await expect(authApi.logout(controller.signal)).resolves.toBeUndefined();

    const expectedConfig = {
      ...sessionOwnedAuthEventPolicy,
      signal: controller.signal,
    };

    expect(mockClientPost).toHaveBeenNthCalledWith(
      1,
      "/auth/login",
      credentials,
      expectedConfig,
    );
    expect(mockClientPost).toHaveBeenNthCalledWith(
      2,
      "/auth/logout",
      undefined,
      expectedConfig,
    );
    expect(expectedConfig).not.toHaveProperty("headers");
    expect(expectedConfig).not.toHaveProperty("params");
    expect(credentials).not.toHaveProperty("authEventPolicy");
  });

  it("lets SessionProvider own error handling for all three session API envelopes", async () => {
    const listener = jest.fn();
    const unsubscribe = onAuthError(listener);
    const expiredSessionEnvelope = {
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
    };

    mockClientGet.mockResolvedValue(expiredSessionEnvelope);
    mockClientPost.mockResolvedValue(expiredSessionEnvelope);

    try {
      await expect(authApi.getMe()).rejects.toMatchObject({ code: "M004" });
      await expect(
        authApi.login({ email: "guest@example.com", password: "password" }),
      ).rejects.toMatchObject({ code: "M004" });
      await expect(authApi.logout()).rejects.toMatchObject({ code: "M004" });

      expect(listener).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it("keeps non-session auth API envelopes on the global event path", async () => {
    const listener = jest.fn();
    const unsubscribe = onAuthError(listener);

    mockClientPost.mockResolvedValue({
      data: {
        success: false,
        data: null,
        error: {
          message: "세션이 만료되었습니다.",
          status: 403,
          code: "M004",
        },
      },
    });

    try {
      await expect(
        authApi.signup({
          nickname: "Guest",
          email: "guest@example.com",
          password: "password",
        }),
      ).rejects.toMatchObject({ code: "M004" });

      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it("rejects a backend getMe error envelope as ApiClientError", async () => {
    const backendError: ErrorResponse = {
      message: "인증이 필요합니다.",
      status: 401,
      code: "AUTH_REQUIRED",
    };

    mockClientGet.mockResolvedValue({
      data: {
        success: false,
        data: null,
        error: backendError,
      },
      headers: {
        "content-type": "application/json;charset=utf-8",
      },
    });

    let thrownError: unknown;
    try {
      await authApi.getMe();
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(ApiClientError);
    const clientError = thrownError as ApiClientError;
    expect(clientError.message).toBe("인증이 필요합니다.");
    expect(clientError.status).toBe(401);
    expect(clientError.code).toBe("AUTH_REQUIRED");
  });

  it("rejects a text/html getMe response as an invalid API response", async () => {
    mockClientGet.mockResolvedValue({
      data: "<!doctype html><html><body>Login</body></html>",
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });

    let thrownError: unknown;
    try {
      await authApi.getMe();
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(ApiClientError);
    const clientError = thrownError as ApiClientError;
    expect(clientError.message).toBe("Invalid API Response");
    expect(clientError.status).toBe(500);
    expect(clientError.code).toBe("INVALID_API_RESPONSE");
  });

  it("keeps AuthContext as a projection over the session owner", () => {
    const authContextSource = readSource("..", "contexts", "AuthContext.tsx");
    const forbiddenOwnership = [
      "authApi",
      "useSessionQuery",
      "useQueryClient",
      "QueryClient",
      "authQueryKeys",
      "useEffect",
      "onAuthError",
      "triggerAuthError",
      "addEventListener",
      "createSessionBroadcast",
      "clearSession",
      "clearAuthenticatedSession",
      "refreshAuthenticatedSession",
      "clearSessionQueryData",
      "clearReservationSessionState",
      "clearAllReservationCheckoutState",
      "document.cookie",
      "sessionStorage",
      "localStorage",
      "setTimeout",
    ];

    expect(authContextSource).toMatch(/useSession\(\s*\)/);
    expect(authContextSource).toMatch(
      /state\.status\s*===\s*["']authenticated["']/,
    );
    expect(authContextSource).toMatch(
      /state\.status\s*===\s*["']checking["']/,
    );
    expect(authContextSource).toMatch(/login:\s*session\.login/);
    expect(authContextSource).toMatch(/logout:\s*session\.logout/);
    expect(authContextSource).toMatch(/checkAuth:\s*session\.revalidate/);

    forbiddenOwnership.forEach((forbiddenSource) => {
      expect(authContextSource).not.toContain(forbiddenSource);
    });
  });

  it("preserves the validated internal return-target boundary", () => {
    const requireAuthSource = readSource("..", "routes", "RequireAuth.tsx");
    const loginRouteSource = readSource(
      "..",
      "app",
      "router",
      "routes",
      "LoginRoute.tsx",
    );
    const returnTargetCodecSource = readSource(
      "..",
      "app",
      "router",
      "codecs",
      "internalReturnTargetCodec.ts",
    );

    expect(requireAuthSource).toMatch(
      /from:\s*{[\s\S]*pathname:\s*location\.pathname,[\s\S]*search:\s*location\.search,[\s\S]*hash:\s*location\.hash/,
    );
    expect(loginRouteSource).toMatch(
      /internalReturnTargetCodec\.parse\(location\.state\)/,
    );
    expect(loginRouteSource).toMatch(
      /locationState=\{returnTarget\s*\?\s*{\s*from:\s*returnTarget\s*}\s*:\s*null}/,
    );
    expect(returnTargetCodecSource).toMatch(/isAuthLoopPath/);
    expect(returnTargetCodecSource).toMatch(/url\.origin\s*!==\s*INTERNAL_BASE/);
  });
});
