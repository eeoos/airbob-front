import { authApi } from "../../../api/auth";
import { ApiClientError } from "../../../api/response";
import { AppError } from "../../../platform/http/errors";
import {
  isSessionAuthenticationError,
  normalizeSessionAuthError,
  sessionAuthPort,
} from "./sessionPort";

jest.mock("../../../api/auth", () => ({
  authApi: {
    getMe: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
  },
}));

describe("sessionAuthPort", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("forwards the caller AbortSignal to every session endpoint", async () => {
    const controller = new AbortController();
    const credentials = {
      email: "member@example.invalid",
      password: "synthetic-password",
    };
    jest.mocked(authApi.getMe).mockResolvedValue({
      id: 1,
      email: credentials.email,
      nickname: "Member",
      thumbnail_image_url: null,
    });
    jest.mocked(authApi.login).mockResolvedValue();
    jest.mocked(authApi.logout).mockResolvedValue();

    await sessionAuthPort.getViewer(controller.signal);
    await sessionAuthPort.login(credentials, controller.signal);
    await sessionAuthPort.logout(controller.signal);

    expect(authApi.getMe).toHaveBeenCalledWith(controller.signal);
    expect(authApi.login).toHaveBeenCalledWith(credentials, controller.signal);
    expect(authApi.logout).toHaveBeenCalledWith(controller.signal);
  });

  it("classifies legacy 401 and M004 envelopes as authentication errors", () => {
    const unauthorized = new ApiClientError({
      message: "Authentication required",
      status: 401,
      code: "M004",
    });

    expect(isSessionAuthenticationError(unauthorized)).toBe(true);
    expect(normalizeSessionAuthError(unauthorized)).toMatchObject({
      kind: "authentication",
      code: "M004",
      status: 401,
    });
  });

  it("classifies retryable server and transport failures without leaking raw messages", () => {
    const serverFailure = new ApiClientError({
      message: "internal database detail",
      status: 503,
      code: "SERVER_FAILURE",
    });
    const normalized = normalizeSessionAuthError(serverFailure);

    expect(normalized).toBeInstanceOf(AppError);
    expect(normalized).toMatchObject({
      kind: "server",
      code: "SERVER_FAILURE",
      retryable: true,
    });
    expect(normalized.message).not.toContain("database");
  });
});
