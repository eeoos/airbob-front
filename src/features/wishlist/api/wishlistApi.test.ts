import {
  requestApiData,
  requestApiDataNullable,
} from "../../../platform/http/request";
import { wishlistApi } from "./wishlistApi";
import withoutReviewsContract from "./__fixtures__/wishlist-detail-without-reviews.json";
import membershipContract from "./__fixtures__/wishlist-membership.json";
import listContract from "./__fixtures__/wishlist-list-with-membership.json";
import {
  toWishlistIndexCardViewModel,
  toWishlistModalItemViewModel,
} from "../lib/wishlistAccommodationViewModel";

vi.mock("../../../platform/http/request", () => ({
  requestApiData: vi.fn(),
  requestApiDataNullable: vi.fn(),
}));

const mockRequestApiData = vi.mocked(requestApiData);
const mockRequestApiDataNullable = vi.mocked(requestApiDataNullable);

describe("wishlist API adapter", () => {
  beforeEach(() => {
    mockRequestApiData.mockReset();
    mockRequestApiDataNullable.mockReset();
  });

  it.each([false, true])(
    "uses the backend list contract in index cards and the save picker (selection=%s)",
    async (selection) => {
      mockRequestApiData.mockResolvedValue({
        ...listContract,
        wishlists: listContract.wishlists.map((item) => ({
          ...item,
          is_contained: selection ? item.is_contained : null,
          wishlist_accommodation_id: selection
            ? item.wishlist_accommodation_id
            : null,
        })),
      });

      const result = await wishlistApi.getWishlists(
        selection ? { accommodationId: 31 } : {},
      );

      expect(result.pageInfo).toEqual({
        hasNext: false,
        nextCursor: null,
        currentSize: 4,
      });
      expect(result.wishlists.map(toWishlistIndexCardViewModel)).toEqual([
        {
          id: 44,
          name: "빈 여행",
          thumbnailUrl: null,
          itemCountLabel: "저장된 항목 0개",
        },
        {
          id: 43,
          name: "함께 여행",
          thumbnailUrl: "https://d1wivnghydqg7i.cloudfront.net/stay.jpg",
          itemCountLabel: "저장된 항목 1개",
        },
        {
          id: 42,
          name: "겨울 여행",
          thumbnailUrl: "https://d1wivnghydqg7i.cloudfront.net/private.jpg",
          itemCountLabel: "저장된 항목 2개",
        },
        {
          id: 41,
          name: "지난 여행",
          thumbnailUrl: null,
          itemCountLabel: "저장된 항목 1개",
        },
      ]);
      expect(
        result.wishlists.map((item) => item.containsAccommodation),
      ).toEqual(
        selection ? [false, true, true, false] : [null, null, null, null],
      );
      expect(
        result.wishlists
          .map(toWishlistModalItemViewModel)
          .map(({ id, isContained, wishlistAccommodationId }) => ({
            id,
            isContained,
            wishlistAccommodationId,
          })),
      ).toEqual([
        { id: 44, isContained: false, wishlistAccommodationId: null },
        {
          id: 43,
          isContained: selection,
          wishlistAccommodationId: selection ? 501 : null,
        },
        {
          id: 42,
          isContained: selection,
          wishlistAccommodationId: selection ? 502 : null,
        },
        { id: 41, isContained: false, wishlistAccommodationId: null },
      ]);
    },
  );

  it("reads the backend membership snapshot without fetching wishlist pages", async () => {
    mockRequestApiData.mockResolvedValue(membershipContract);
    const signal = new AbortController().signal;
    await expect(
      wishlistApi.getAccommodationMembership(
        { accommodationId: 31, wishlistId: 42 },
        { signal },
      ),
    ).resolves.toEqual({
      isInAnyWishlist: true,
      targetWishlistContains: false,
      targetWishlistFound: true,
    });
    expect(mockRequestApiData).toHaveBeenCalledExactlyOnceWith({
      method: "GET",
      path: "/members/wishlists/membership",
      params: { accommodationId: 31, wishlistId: 42 },
      signal,
    });
  });

  it.each([
    {
      is_in_any_wishlist: null,
      target_wishlist_contains: null,
      target_wishlist_found: false,
    },
    {
      is_in_any_wishlist: true,
      target_wishlist_contains: null,
      target_wishlist_found: true,
    },
    {
      is_in_any_wishlist: true,
      target_wishlist_contains: false,
      target_wishlist_found: false,
    },
  ])(
    "rejects incomplete membership snapshots instead of confirming a guessed state",
    async (wire) => {
      mockRequestApiData.mockResolvedValue(wire);
      await expect(
        wishlistApi.getAccommodationMembership({ accommodationId: 31 }),
      ).rejects.toThrow(TypeError);
    },
  );

  it("preserves the create wire body while exposing a camelCase input", async () => {
    const signal = new AbortController().signal;
    mockRequestApiData.mockResolvedValue({ id: 7 });

    await expect(
      wishlistApi.create({ name: "여름 여행" }, { signal }),
    ).resolves.toEqual({
      id: 7,
    });
    expect(mockRequestApiData).toHaveBeenCalledWith({
      method: "POST",
      path: "/members/wishlists",
      body: { name: "여름 여행" },
      signal,
    });
  });

  it("maps list query parameters and the collection response", async () => {
    const signal = new AbortController().signal;
    mockRequestApiData.mockResolvedValue({
      wishlists: [
        {
          id: 7,
          name: "여름 여행",
          created_at: "2026-07-01T00:00:00Z",
          wishlist_item_count: 1,
          thumbnail_image_url: null,
          is_contained: null,
          wishlist_accommodation_id: null,
        },
      ],
      page_info: { has_next: false, next_cursor: null, current_size: 1 },
    });

    await expect(
      wishlistApi.getWishlists(
        { accommodationId: 31, cursor: "cursor-1", size: 20 },
        { signal },
      ),
    ).resolves.toMatchObject({
      wishlists: [{ createdAt: "2026-07-01T00:00:00Z", itemCount: 1 }],
      pageInfo: { hasNext: false, nextCursor: null, currentSize: 1 },
    });

    expect(mockRequestApiData).toHaveBeenCalledWith({
      method: "GET",
      path: "/members/wishlists",
      params: { accommodationId: 31, cursor: "cursor-1", size: 20 },
      signal,
    });
  });

  it("maps accommodation commands to the exact backend paths and bodies", async () => {
    const signal = new AbortController().signal;
    mockRequestApiData
      .mockResolvedValueOnce({ id: 91 })
      .mockResolvedValueOnce({ id: 91 });
    mockRequestApiDataNullable.mockResolvedValue(null);

    await wishlistApi.addAccommodation(7, { accommodationId: 31 }, { signal });
    await wishlistApi.updateAccommodationMemo(
      91,
      { memo: "창가 방" },
      {
        signal,
      },
    );
    await wishlistApi.removeAccommodation(91, { signal });
    await wishlistApi.delete(7, { signal });

    expect(mockRequestApiData).toHaveBeenNthCalledWith(1, {
      method: "POST",
      path: "/members/wishlists/accommodations/7",
      body: { accommodation_id: 31 },
      signal,
    });
    expect(mockRequestApiData).toHaveBeenNthCalledWith(2, {
      method: "PATCH",
      path: "/members/wishlists/accommodations/91",
      body: { memo: "창가 방" },
      signal,
    });
    expect(mockRequestApiDataNullable).toHaveBeenNthCalledWith(1, {
      method: "DELETE",
      path: "/members/wishlists/accommodations/91",
      signal,
    });
    expect(mockRequestApiDataNullable).toHaveBeenNthCalledWith(2, {
      method: "DELETE",
      path: "/members/wishlists/7",
      signal,
    });
  });

  it("maps wishlist detail pagination and response fields", async () => {
    mockRequestApiData.mockResolvedValue({
      wishlist_name: "여름 여행",
      wishlist_accommodations: [],
      page_info: { has_next: true, next_cursor: "next", current_size: 0 },
    });

    await expect(
      wishlistApi.getWishlistAccommodations(7, {
        cursor: "cursor-1",
        size: 20,
      }),
    ).resolves.toEqual({
      wishlistName: "여름 여행",
      accommodations: [],
      pageInfo: { hasNext: true, nextCursor: "next", currentSize: 0 },
    });

    expect(mockRequestApiData).toHaveBeenCalledWith({
      method: "GET",
      path: "/members/wishlists/accommodations/7",
      params: { cursor: "cursor-1", size: 20 },
      signal: undefined,
    });
  });

  it("consumes the backend MySQL no-review contract with distinct action IDs", async () => {
    mockRequestApiData.mockResolvedValue(withoutReviewsContract);

    await expect(
      wishlistApi.getWishlistAccommodations(42, { size: 20 }),
    ).resolves.toEqual({
      wishlistName: "여름 여행",
      accommodations: [
        {
          wishlistAccommodationId: 501,
          memo: "창가 방",
          createdAt: "2026-07-02T00:00:00Z",
          accommodation: {
            id: 31,
            name: "서울 하우스",
            thumbnailUrl: "/stay.jpg",
          },
          addressSummary: {
            country: "대한민국",
            state: null,
            city: "서울",
            district: "마포구",
          },
          reviewSummary: { totalCount: 0, averageRating: 0 },
          isInWishlist: true,
        },
      ],
      pageInfo: { hasNext: false, nextCursor: null, currentSize: 1 },
    });
    expect(mockRequestApiData).toHaveBeenCalledWith({
      method: "GET",
      path: "/members/wishlists/accommodations/42",
      params: { cursor: undefined, size: 20 },
      signal: undefined,
    });
  });
});
