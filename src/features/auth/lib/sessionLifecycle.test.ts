import { QueryClient } from "@tanstack/react-query";
import { authApi } from "../../../api";
import { clearAllReservationCheckoutState } from "../../reservations/publicCache";
import { authQueryKeys } from "../queryKeys";
import {
  clearAuthenticatedSession,
  refreshAuthenticatedSession,
} from "./sessionLifecycle";

jest.mock("../../../api", () => ({
  authApi: {
    getMe: jest.fn(),
  },
}));

jest.mock("../../reservations/publicCache", () => ({
  clearAllReservationCheckoutState: jest.fn(),
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

describe("sessionLifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("clears reservation checkout state when clearing authenticated session", async () => {
    const queryClient = createQueryClient();

    await clearAuthenticatedSession(queryClient);

    expect(clearAllReservationCheckoutState).toHaveBeenCalledTimes(1);
  });

  it("refreshes session data from authApi.getMe", async () => {
    const queryClient = createQueryClient();
    const meInfo = {
      id: 1,
      email: "qa@example.com",
      nickname: "QA",
      thumbnail_image_url: null,
    };
    jest.mocked(authApi.getMe).mockResolvedValueOnce(meInfo);

    await refreshAuthenticatedSession(queryClient);

    expect(authApi.getMe).toHaveBeenCalledTimes(1);
  });

  it("writes refreshed auth session data into the query client", async () => {
    const queryClient = createQueryClient();
    const meInfo = {
      id: 1,
      email: "qa@example.com",
      nickname: "QA",
      thumbnail_image_url: null,
    };
    jest.mocked(authApi.getMe).mockResolvedValueOnce(meInfo);

    await refreshAuthenticatedSession(queryClient);

    expect(queryClient.getQueryData(authQueryKeys.me())).toEqual(meInfo);
  });

  it("clears authenticated session and rethrows original error when refresh fails", async () => {
    const queryClient = createQueryClient();
    const staleMeInfo = {
      id: 1,
      email: "stale@example.com",
      nickname: "Stale",
      thumbnail_image_url: null,
    };
    const refreshError = new Error("refresh failed");
    queryClient.setQueryData(authQueryKeys.me(), staleMeInfo);
    jest.mocked(authApi.getMe).mockRejectedValueOnce(refreshError);

    await expect(refreshAuthenticatedSession(queryClient)).rejects.toBe(
      refreshError
    );

    expect(clearAllReservationCheckoutState).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(authQueryKeys.me())).toBeNull();
  });
});
