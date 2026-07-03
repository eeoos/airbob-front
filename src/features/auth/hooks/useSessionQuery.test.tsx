import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { authApi } from "../../../api";
import { MeInfo } from "../../../types/auth";
import { authQueryKeys } from "../queryKeys";
import { useSessionQuery } from "./useSessionQuery";

jest.mock("../../../api", () => ({
  authApi: {
    getMe: jest.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { Wrapper, queryClient };
};

describe("useSessionQuery", () => {
  beforeEach(() => {
    jest.mocked(authApi.getMe).mockReset();
  });

  it("returns authenticated session data from getMe", async () => {
    const meInfo: MeInfo = {
      id: 1,
      email: "guest@example.com",
      nickname: "Guest",
      thumbnail_image_url: null,
    };
    jest.mocked(authApi.getMe).mockResolvedValue(meInfo);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useSessionQuery(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(meInfo);
    expect(result.current.error).toBeNull();
    expect(authApi.getMe).toHaveBeenCalledTimes(1);
    expect(authApi.getMe).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("stores a failed getMe as query error without throwing during render", async () => {
    const authError = new Error("인증이 필요합니다.");
    jest.mocked(authApi.getMe).mockRejectedValue(authError);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useSessionQuery(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBe(authError);
    expect(authApi.getMe).toHaveBeenCalledTimes(1);
  });

  it("opts the session query back into focus refetching", () => {
    jest.mocked(authApi.getMe).mockResolvedValue({
      id: 1,
      email: "guest@example.com",
      nickname: "Guest",
      thumbnail_image_url: null,
    });
    const { Wrapper, queryClient } = createWrapper();

    renderHook(() => useSessionQuery(), {
      wrapper: Wrapper,
    });

    const sessionQuery = queryClient
      .getQueryCache()
      .find({ queryKey: authQueryKeys.me() });

    expect(sessionQuery?.options.refetchOnWindowFocus).toBe(true);
  });
});
