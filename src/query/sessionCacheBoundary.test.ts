import { QueryClient } from "@tanstack/react-query";
import { authQueryKeys } from "../features/auth/queryKeys";
import { profileQueryKeys } from "../features/profile/queryKeys";
import { reservationQueryKeys } from "../features/reservations/queryKeys";
import { searchQueryKeys } from "../features/search/queryKeys";
import { wishlistQueryKeys } from "../features/wishlist/queryKeys";
import { MeInfo } from "../types/auth";
import { refreshSessionQueryData } from "./sessionCacheBoundary";

const meInfo: MeInfo = {
  id: 2573,
  email: "qa@etl.airbob.local",
  nickname: "Airbob QA",
  thumbnail_image_url: null,
};

describe("sessionCacheBoundary", () => {
  it("cancels user-scoped query roots before removing them on session refresh", async () => {
    const queryClient = new QueryClient();
    const cancelResolvers: Array<() => void> = [];
    const cancelSpy = jest.spyOn(queryClient, "cancelQueries").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          cancelResolvers.push(resolve);
        })
    );
    const removeSpy = jest.spyOn(queryClient, "removeQueries");

    const refreshPromise = refreshSessionQueryData(queryClient, meInfo);

    const cancelledRoots = cancelSpy.mock.calls.map(
      ([options]) => options?.queryKey
    );
    expect(cancelledRoots).toEqual([
      wishlistQueryKeys.all,
      profileQueryKeys.all,
      reservationQueryKeys.all,
      searchQueryKeys.all,
    ]);
    expect(cancelResolvers).toHaveLength(4);
    expect(removeSpy).not.toHaveBeenCalled();

    cancelResolvers.slice(0, 3).forEach((resolve) => resolve());
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(removeSpy).not.toHaveBeenCalled();

    cancelResolvers[3]();
    await refreshPromise;

    const removedRoots = removeSpy.mock.calls.map(
      ([options]) => options?.queryKey
    );
    expect(removedRoots).toEqual([
      wishlistQueryKeys.all,
      profileQueryKeys.all,
      reservationQueryKeys.all,
      searchQueryKeys.all,
    ]);
    expect(queryClient.getQueryData(authQueryKeys.me())).toEqual(meInfo);
  });
});
