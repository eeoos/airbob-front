import { QueryClient } from "@tanstack/react-query";
import { accommodationQueryKeys } from "../features/accommodations/queryKeys";
import { authQueryKeys } from "../features/auth/queryKeys";
import { profileQueryKeys } from "../features/profile/queryKeys";
import { reservationQueryKeys } from "../features/reservations/queryKeys";
import { searchQueryKeys } from "../features/search/queryKeys";
import { wishlistQueryKeys } from "../features/wishlist/queryKeys";
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
      accommodationQueryKeys.detailRoot,
      accommodationQueryKeys.couponsRoot,
      wishlistQueryKeys.all,
      profileQueryKeys.all,
      reservationQueryKeys.all,
      searchQueryKeys.all,
    ]);
    expect(cancelResolvers).toHaveLength(6);
    expect(removeSpy).not.toHaveBeenCalled();

    cancelResolvers.slice(0, 5).forEach((resolve) => resolve());
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(removeSpy).not.toHaveBeenCalled();

    cancelResolvers[5]();
    await refreshPromise;

    const removedRoots = removeSpy.mock.calls.map(
      ([options]) => options?.queryKey
    );
    expect(removedRoots).toEqual([
      accommodationQueryKeys.detailRoot,
      accommodationQueryKeys.couponsRoot,
      wishlistQueryKeys.all,
      profileQueryKeys.all,
      reservationQueryKeys.all,
      searchQueryKeys.all,
    ]);
    expect(queryClient.getQueryData(authQueryKeys.me())).toEqual(meInfo);
  });

  it("removes accommodation detail query data on session clear", async () => {
    const queryClient = new QueryClient();
    const detailQueryKey = accommodationQueryKeys.detail(7, 0);

    queryClient.setQueryData(detailQueryKey, {
      id: 7,
      is_in_wishlist: true,
    });
    queryClient.setQueryData(accommodationQueryKeys.validCoupons(), {
      infos: [{ id: 1 }],
    });
    queryClient.setQueryData(authQueryKeys.me(), meInfo);

    await clearSessionQueryData(queryClient);

    expect(queryClient.getQueryData(detailQueryKey)).toBeUndefined();
    expect(
      queryClient.getQueryData(accommodationQueryKeys.validCoupons()),
    ).toBeUndefined();
    expect(queryClient.getQueryData(authQueryKeys.me())).toBeNull();
  });
});
