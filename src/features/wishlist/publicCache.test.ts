import type { QueryClient } from "@tanstack/react-query";
import { invalidateWishlistCaches } from "./publicCache";
import { wishlistQueryKeys } from "./queryKeys";

jest.mock("./lib/wishlistCacheSync", () => ({
  setAccommodationScopedWishlistMembershipCache: jest.fn(),
}));

jest.mock("./lib/wishlistMembership", () => ({
  fetchAccommodationWishlistMembership: jest.fn(),
}));

describe("wishlist public cache boundary", () => {
  it("invalidates wishlist collection and recently viewed caches", () => {
    const invalidateQueries = jest.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    invalidateWishlistCaches(queryClient);

    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: wishlistQueryKeys.all,
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: wishlistQueryKeys.recentlyViewed(),
    });
  });
});
