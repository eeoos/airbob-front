import { authApi } from "../api/authApi";
import { AppError } from "../../../platform/http/errors";
import {
  isSessionAuthenticationError,
  normalizeSessionAuthError,
  sessionAuthPort,
} from "./sessionPort";

vi.mock("../api/authApi", () => ({
  authApi: {
    getViewer: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));

describe("sessionAuthPort", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the caller AbortSignal to every session endpoint", async () => {
    const controller = new AbortController();
    const credentials = {
      email: "member@example.invalid",
      password: "synthetic-password",
    };
    vi.mocked(authApi.getViewer).mockResolvedValue({
      id: 1,
      email: credentials.email,
      nickname: "Member",
      thumbnailImageUrl: null,
    });
    vi.mocked(authApi.login).mockResolvedValue();
    vi.mocked(authApi.logout).mockResolvedValue();

    await sessionAuthPort.getViewer(controller.signal);
    await sessionAuthPort.login(credentials, controller.signal);
    await sessionAuthPort.logout(controller.signal);

    expect(authApi.getViewer).toHaveBeenCalledWith(controller.signal);
    expect(authApi.login).toHaveBeenCalledWith(credentials, controller.signal);
    expect(authApi.logout).toHaveBeenCalledWith(controller.signal);
  });

  it("classifies legacy 401 and M004 envelopes as authentication errors", () => {
    const unauthorized = {
      message: "Authentication required",
      status: 401,
      code: "M004",
    };

    expect(isSessionAuthenticationError(unauthorized)).toBe(true);
    expect(normalizeSessionAuthError(unauthorized)).toMatchObject({
      kind: "authentication",
      code: "M004",
      status: 401,
    });
  });

  it("classifies retryable server and transport failures without leaking raw messages", () => {
    const serverFailure = {
      message: "internal database detail",
      status: 503,
      code: "SERVER_FAILURE",
    };
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
