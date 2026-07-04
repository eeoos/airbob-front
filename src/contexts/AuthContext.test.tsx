import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { authApi } from "../api";
import { AuthProvider, useAuth } from "./AuthContext";
import { authQueryKeys } from "../features/auth/queryKeys";
import { profileQueryKeys } from "../features/profile/queryKeys";
import { reservationQueryKeys } from "../features/reservations/queryKeys";
import { searchQueryKeys } from "../features/search/queryKeys";
import { wishlistQueryKeys } from "../features/wishlist/queryKeys";
import { clearSessionQueryData } from "../query/sessionCacheBoundary";
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

  return {
    ...renderHook(() => useAuth(), { wrapper }),
    queryClient,
  };
};

const waitForSessionSettled = async (
  result: ReturnType<typeof renderUseAuth>["result"]
) => {
  await waitFor(() => expect(result.current.isLoading).toBe(false));
};

const waitForAuthEventThrottleReset = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 1100);
  });

const seedUserScopedQueryData = (queryClient: QueryClient) => {
  queryClient.setQueryData(searchQueryKeys.results("destination=Seoul"), {
    page_info: { current_page: 0, total_pages: 1, total_elements: 1 },
    stay_search_result_listing: [{ id: 1, is_in_wishlist: true }],
  });
  queryClient.setQueryData(wishlistQueryKeys.recentlyViewed(), {
    accommodations: [{ accommodation_id: 1, is_in_wishlist: true }],
    total_count: 1,
  });
  queryClient.setQueryData(profileQueryKeys.hostListings("status=PUBLISHED"), {
    pages: [],
    pageParams: [],
  });
  queryClient.setQueryData(
    reservationQueryKeys.guestReservations("tab=upcoming"),
    {
      pages: [],
      pageParams: [],
    }
  );
};

const expectUserScopedQueryDataCleared = (queryClient: QueryClient) => {
  expect(
    queryClient.getQueryData(searchQueryKeys.results("destination=Seoul"))
  ).toBeUndefined();
  expect(
    queryClient.getQueryData(wishlistQueryKeys.recentlyViewed())
  ).toBeUndefined();
  expect(
    queryClient.getQueryData(profileQueryKeys.hostListings("status=PUBLISHED"))
  ).toBeUndefined();
  expect(
    queryClient.getQueryData(
      reservationQueryKeys.guestReservations("tab=upcoming")
    )
  ).toBeUndefined();
};

describe("AuthProvider", () => {
  let triggeredAuthError = false;

  beforeEach(() => {
    triggeredAuthError = false;
    jest.mocked(authApi.getMe).mockReset();
    jest.mocked(authApi.login).mockReset();
    jest.mocked(authApi.logout).mockReset();
    document.cookie = "SESSION_ID=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    sessionStorage.clear();
  });

  afterEach(async () => {
    jest.restoreAllMocks();

    if (triggeredAuthError) {
      await waitForAuthEventThrottleReset();
    }
  });

  const triggerAuthErrorThenReject = async (error: Error) => {
    triggeredAuthError = true;
    triggerAuthError();
    await Promise.resolve();
    throw error;
  };

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

  it("rejects checkAuth when the auth interceptor clears the active session before getMe rejects", async () => {
    const authError = new Error("세션이 만료되었습니다.");
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest
      .mocked(authApi.getMe)
      .mockResolvedValueOnce(meInfo)
      .mockImplementationOnce(() => triggerAuthErrorThenReject(authError));

    const { result } = renderUseAuth();
    await waitForSessionSettled(result);
    expect(result.current.isAuthenticated).toBe(true);

    let didResolve = false;
    let thrownError: unknown;
    await act(async () => {
      try {
        await result.current.checkAuth();
        didResolve = true;
      } catch (error) {
        thrownError = error;
      }
    });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(didResolve).toBe(false);
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

  it("rejects login when the auth interceptor clears the active session before post-login getMe rejects", async () => {
    const refreshError = new Error("세션 확인에 실패했습니다.");
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest
      .mocked(authApi.getMe)
      .mockResolvedValueOnce(meInfo)
      .mockImplementationOnce(() => triggerAuthErrorThenReject(refreshError));
    jest.mocked(authApi.login).mockResolvedValueOnce(undefined);

    const { result } = renderUseAuth();
    await waitForSessionSettled(result);
    expect(result.current.isAuthenticated).toBe(true);

    let didResolve = false;
    let thrownError: unknown;
    await act(async () => {
      try {
        await result.current.login(credentials);
        didResolve = true;
      } catch (error) {
        thrownError = error;
      }
    });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(authApi.login).toHaveBeenCalledWith(credentials);
    expect(didResolve).toBe(false);
    expect(thrownError).toBe(refreshError);
  });

  it("cancels any stale session query before refreshing session after login", async () => {
    const staleSession = new Promise<MeInfo>(() => {});
    jest
      .mocked(authApi.getMe)
      .mockReturnValueOnce(staleSession)
      .mockResolvedValueOnce(meInfo);
    jest.mocked(authApi.login).mockResolvedValueOnce(undefined);

    const { result, queryClient } = renderUseAuth();
    const cancelQueriesSpy = jest.spyOn(queryClient, "cancelQueries");

    await act(async () => {
      await result.current.login(credentials);
    });

    expect(authApi.login).toHaveBeenCalledWith(credentials);
    expect(cancelQueriesSpy).toHaveBeenCalledWith({
      queryKey: authQueryKeys.me(),
    });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
  });

  it("keeps authenticated state when server logout rejects", async () => {
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

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(thrownError).toBe(logoutError);
    expect(document.cookie).toContain("SESSION_ID=test-session");
  });

  it("clears authenticated state and the session cookie when logout succeeds", async () => {
    jest.mocked(authApi.getMe).mockResolvedValueOnce(meInfo);
    jest.mocked(authApi.logout).mockResolvedValueOnce(undefined);
    document.cookie = "SESSION_ID=test-session; path=/;";

    const { result } = renderUseAuth();
    await waitForSessionSettled(result);
    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.logout();
    });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(document.cookie).not.toContain("SESSION_ID=");
  });

  it("clears user-scoped query data on logout", async () => {
    jest.mocked(authApi.getMe).mockResolvedValueOnce(meInfo);
    jest.mocked(authApi.logout).mockResolvedValueOnce(undefined);

    const { result, queryClient } = renderUseAuth();
    await waitForSessionSettled(result);

    seedUserScopedQueryData(queryClient);

    await act(async () => {
      await result.current.logout();
    });

    expectUserScopedQueryDataCleared(queryClient);
    expect(queryClient.getQueryData(authQueryKeys.me())).toBeNull();
  });

  it("clears reservation checkout fallback storage on logout", async () => {
    jest.mocked(authApi.getMe).mockResolvedValueOnce(meInfo);
    jest.mocked(authApi.logout).mockResolvedValueOnce(undefined);
    sessionStorage.setItem("airbob:reservation-checkout:7", "checkout");
    sessionStorage.setItem("airbob:reservation-checkout-index:reservation-123", "7");
    sessionStorage.setItem("airbob:unrelated", "keep");

    const { result } = renderUseAuth();
    await waitForSessionSettled(result);

    await act(async () => {
      await result.current.logout();
    });

    expect(sessionStorage.getItem("airbob:reservation-checkout:7")).toBeNull();
    expect(
      sessionStorage.getItem("airbob:reservation-checkout-index:reservation-123")
    ).toBeNull();
    expect(sessionStorage.getItem("airbob:unrelated")).toBe("keep");
  });

  it("clears authenticated state when the global auth error event fires", async () => {
    jest.mocked(authApi.getMe).mockResolvedValueOnce(meInfo);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const { result } = renderUseAuth();
    await waitForSessionSettled(result);
    expect(result.current.isAuthenticated).toBe(true);

    await act(async () => {
      triggeredAuthError = true;
      triggerAuthError();
    });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    warnSpy.mockRestore();
  });

  it("clears user-scoped query data when the global auth error event clears the session", async () => {
    jest.mocked(authApi.getMe).mockResolvedValueOnce(meInfo);
    jest.spyOn(console, "warn").mockImplementation(() => {});

    const { result, queryClient } = renderUseAuth();
    await waitForSessionSettled(result);

    seedUserScopedQueryData(queryClient);

    await act(async () => {
      triggeredAuthError = true;
      triggerAuthError();
    });

    await waitFor(() => {
      expectUserScopedQueryDataCleared(queryClient);
      expect(queryClient.getQueryData(authQueryKeys.me())).toBeNull();
    });
  });

  it("clears reservation checkout fallback storage when the global auth error event clears the session", async () => {
    jest.mocked(authApi.getMe).mockResolvedValueOnce(meInfo);
    jest.spyOn(console, "warn").mockImplementation(() => {});
    sessionStorage.setItem("airbob:reservation-checkout:7", "checkout");
    sessionStorage.setItem("airbob:reservation-checkout-index:reservation-123", "7");

    const { result } = renderUseAuth();
    await waitForSessionSettled(result);

    await act(async () => {
      triggeredAuthError = true;
      triggerAuthError();
    });

    await waitFor(() => {
      expect(sessionStorage.getItem("airbob:reservation-checkout:7")).toBeNull();
      expect(
        sessionStorage.getItem("airbob:reservation-checkout-index:reservation-123")
      ).toBeNull();
    });
  });

  it("leaves auth session query data null when clearing without an active session observer", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData<MeInfo | null>(authQueryKeys.me(), meInfo);

    await clearSessionQueryData(queryClient);

    expect(queryClient.getQueryData(authQueryKeys.me())).toBeNull();
  });
});
