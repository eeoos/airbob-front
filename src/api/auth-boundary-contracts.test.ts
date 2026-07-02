import * as fs from "fs";
import * as path from "path";
import { ErrorResponse } from "../types/api";
import { MeInfo } from "../types/auth";
import { authApi } from "./auth";
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

  beforeEach(() => {
    mockClientGet.mockReset();
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
    expect(mockClientGet).toHaveBeenCalledWith("/auth/me");
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

  it("keeps AuthContext authentication checks behind authApi.getMe", () => {
    const authContextSource = readSource("..", "contexts", "AuthContext.tsx");

    expect(authContextSource).not.toMatch(/from\s+["']\.\.\/api\/client["'];?/);
    expect(authContextSource).not.toMatch(/client\.get\(\s*["']\/auth\/me["']\s*\)/);
    expect(authContextSource).toMatch(/await\s+authApi\.getMe\(\s*\);/);
    expect(authContextSource).toMatch(/setIsAuthenticated\(\s*true\s*\);/);
    expect(authContextSource).toMatch(/finally\s*\{[\s\S]*setIsLoading\(\s*false\s*\);[\s\S]*\}/);
  });
});
