import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { authApi } from "../api";
import { AuthProvider, useAuth } from "./AuthContext";
import { triggerAuthError } from "../utils/authEvents";
import { LoginRequest, MeInfo } from "../types/auth";

jest.mock("../api", () => ({
  authApi: {
    getMe: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
  },
}));

const meInfo: MeInfo = {
  id: 1,
  email: "guest@example.com",
  nickname: "Guest",
  thumbnail_image_url: null,
};

const credentials: LoginRequest = {
  email: "guest@example.com",
  password: "password123",
};

const renderUseAuth = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );

  return renderHook(() => useAuth(), { wrapper });
};

const waitForSessionSettled = async (
  result: ReturnType<typeof renderUseAuth>["result"]
) => {
  await waitFor(() => expect(result.current.isLoading).toBe(false));
};

describe("AuthProvider", () => {
  beforeEach(() => {
    jest.mocked(authApi.getMe).mockReset();
    jest.mocked(authApi.login).mockReset();
    jest.mocked(authApi.logout).mockReset();
    document.cookie = "SESSION_ID=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  });

  it("exposes authenticated state after the first successful session load", async () => {
    jest.mocked(authApi.getMe).mockResolvedValueOnce(meInfo);

    const { result } = renderUseAuth();

    await waitForSessionSettled(result);

    expect(result.current.isAuthenticated).toBe(true);
    expect(authApi.getMe).toHaveBeenCalledTimes(1);
  });

  it("exposes unauthenticated state when the first session load fails without throwing during render", async () => {
    jest.mocked(authApi.getMe).mockRejectedValueOnce(
      new Error("인증이 필요합니다.")
    );

    const { result } = renderUseAuth();

    await waitForSessionSettled(result);

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("clears stale authenticated state when checkAuth refetch fails after cached session data", async () => {
    const authError = new Error("세션이 만료되었습니다.");
    jest
      .mocked(authApi.getMe)
      .mockResolvedValueOnce(meInfo)
      .mockRejectedValueOnce(authError);

    const { result } = renderUseAuth();
    await waitForSessionSettled(result);
    expect(result.current.isAuthenticated).toBe(true);

    let thrownError: unknown;
    await act(async () => {
      try {
        await result.current.checkAuth();
      } catch (error) {
        thrownError = error;
      }
    });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(thrownError).toBe(authError);
  });

  it("clears stale authenticated state and rejects login when the post-login session refresh fails", async () => {
    const refreshError = new Error("세션 확인에 실패했습니다.");
    jest
      .mocked(authApi.getMe)
      .mockResolvedValueOnce(meInfo)
      .mockRejectedValueOnce(refreshError);
    jest.mocked(authApi.login).mockResolvedValueOnce(undefined);

    const { result } = renderUseAuth();
    await waitForSessionSettled(result);
    expect(result.current.isAuthenticated).toBe(true);

    let thrownError: unknown;
    await act(async () => {
      try {
        await result.current.login(credentials);
      } catch (error) {
        thrownError = error;
      }
    });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(authApi.login).toHaveBeenCalledWith(credentials);
    expect(thrownError).toBe(refreshError);
  });

  it("clears authenticated state and the session cookie when logout rejects", async () => {
    const logoutError = new Error("로그아웃 실패");
    jest.mocked(authApi.getMe).mockResolvedValueOnce(meInfo);
    jest.mocked(authApi.logout).mockRejectedValueOnce(logoutError);
    document.cookie = "SESSION_ID=test-session; path=/;";

    const { result } = renderUseAuth();
    await waitForSessionSettled(result);
    expect(result.current.isAuthenticated).toBe(true);

    let thrownError: unknown;
    await act(async () => {
      try {
        await result.current.logout();
      } catch (error) {
        thrownError = error;
      }
    });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(thrownError).toBe(logoutError);
    expect(document.cookie).not.toContain("SESSION_ID=");
  });

  it("clears authenticated state when the global auth error event fires", async () => {
    jest.mocked(authApi.getMe).mockResolvedValueOnce(meInfo);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const { result } = renderUseAuth();
    await waitForSessionSettled(result);
    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      triggerAuthError();
    });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    warnSpy.mockRestore();
  });
});
