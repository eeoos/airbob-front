import { QueryClient } from "@tanstack/react-query";
import { authQueryKeys } from "../features/auth/queryKeys";
import { MeInfo } from "../types/auth";
import {
  clearSessionQueryData,
  refreshSessionQueryData,
} from "./sessionCacheBoundary";

const meInfo: MeInfo = {
  id: 9001,
  email: "synthetic-member@example.invalid",
  nickname: "Synthetic Member",
  thumbnail_image_url: null,
};

const futureViewerQueryKey = ["future-feature", "viewer-resource", 1] as const;
const authSiblingQueryKey = ["auth", "permissions"] as const;
const authMeDescendantQueryKey = ["auth", "me", "history"] as const;

const seedQueries = (queryClient: QueryClient) => {
  queryClient.setQueryData(authQueryKeys.me(), meInfo);
  queryClient.setQueryData(futureViewerQueryKey, { owner: "old-subject" });
  queryClient.setQueryData(authSiblingQueryKey, { permissions: ["host"] });
  queryClient.setQueryData(authMeDescendantQueryKey, { entries: [] });
};

const expectOnlyExactAuthMeRemains = (
  queryClient: QueryClient,
  expectedMeInfo: MeInfo | null,
) => {
  expect(queryClient.getQueryData(authQueryKeys.me())).toEqual(expectedMeInfo);
  expect(queryClient.getQueryData(futureViewerQueryKey)).toBeUndefined();
  expect(queryClient.getQueryData(authSiblingQueryKey)).toBeUndefined();
  expect(queryClient.getQueryData(authMeDescendantQueryKey)).toBeUndefined();
};

describe("sessionCacheBoundary", () => {
  it("waits for non-session query cancellation before removing queries on refresh", async () => {
    const queryClient = new QueryClient();
    seedQueries(queryClient);
    let resolveCancellation: () => void = () => undefined;
    const cancelSpy = jest.spyOn(queryClient, "cancelQueries").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCancellation = resolve;
        }),
    );
    const removeSpy = jest.spyOn(queryClient, "removeQueries");

    const refreshPromise = refreshSessionQueryData(queryClient, meInfo);

    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(cancelSpy.mock.calls[0]?.[0]?.predicate).toEqual(expect.any(Function));
    expect(removeSpy).not.toHaveBeenCalled();

    resolveCancellation();
    await refreshPromise;

    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy.mock.calls[0]?.[0]?.predicate).toEqual(expect.any(Function));
  });

  it("removes arbitrary future queries while preserving only the exact auth/me key on refresh", async () => {
    const queryClient = new QueryClient();
    seedQueries(queryClient);
    const refreshedMeInfo = { ...meInfo, nickname: "Refreshed Member" };

    await refreshSessionQueryData(queryClient, refreshedMeInfo);

    expectOnlyExactAuthMeRemains(queryClient, refreshedMeInfo);
  });

  it("removes arbitrary future queries before setting auth/me to null on clear", async () => {
    const queryClient = new QueryClient();
    seedQueries(queryClient);

    await clearSessionQueryData(queryClient);

    expectOnlyExactAuthMeRemains(queryClient, null);
  });

  it("cancels auth/me separately without including it in the broad query predicate", async () => {
    const queryClient = new QueryClient();
    seedQueries(queryClient);
    const cancelSpy = jest.spyOn(queryClient, "cancelQueries");

    await clearSessionQueryData(queryClient);

    expect(cancelSpy).toHaveBeenCalledTimes(2);
    expect(cancelSpy.mock.calls[0]?.[0]?.predicate).toEqual(expect.any(Function));
    expect(cancelSpy.mock.calls[1]?.[0]).toEqual({
      exact: true,
      queryKey: authQueryKeys.me(),
    });
  });

  it("waits for exact auth/me cancellation before publishing anonymous state", async () => {
    const queryClient = new QueryClient();
    seedQueries(queryClient);
    let resolveAuthCancellation: () => void = () => undefined;
    let markAuthCancellationStarted: () => void = () => undefined;
    const authCancellationStarted = new Promise<void>((resolve) => {
      markAuthCancellationStarted = resolve;
    });
    jest
      .spyOn(queryClient, "cancelQueries")
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(
        () => {
          markAuthCancellationStarted();
          return new Promise<void>((resolve) => {
            resolveAuthCancellation = resolve;
          });
        },
      );

    const clearPromise = clearSessionQueryData(queryClient);
    await authCancellationStarted;

    expect(queryClient.getQueryData(authQueryKeys.me())).toEqual(meInfo);

    resolveAuthCancellation();
    await clearPromise;

    expect(queryClient.getQueryData(authQueryKeys.me())).toBeNull();
  });
});
