import type { ApiTransport } from "./transport";
import { createWishlistApi } from "./wishlistApi";

const createTransport = () => {
  const request = vi.fn();
  const requestNullable = vi.fn();

  return {
    transport: { request, requestNullable } as ApiTransport,
    request,
    requestNullable,
  };
};

describe("wishlist API adapter", () => {
  it("preserves the create wire body while exposing a camelCase input", async () => {
    const { transport, request } = createTransport();
    const api = createWishlistApi(transport);
    const signal = new AbortController().signal;
    request.mockResolvedValue({ id: 7 });

    await expect(api.create({ name: "여름 여행" }, { signal })).resolves.toEqual({
      id: 7,
    });
    expect(request).toHaveBeenCalledWith({
      method: "POST",
      path: "/members/wishlists",
      body: { name: "여름 여행" },
      signal,
    });
  });

  it("maps list query parameters and the collection response", async () => {
    const { transport, request } = createTransport();
    const api = createWishlistApi(transport);
    const signal = new AbortController().signal;
    request.mockResolvedValue({
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
      api.getWishlists(
        { accommodationId: 31, cursor: "cursor-1", size: 20 },
        { signal },
      ),
    ).resolves.toMatchObject({
      wishlists: [{ createdAt: "2026-07-01T00:00:00Z", itemCount: 1 }],
      pageInfo: { hasNext: false, nextCursor: null, currentSize: 1 },
    });

    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/members/wishlists",
      params: { accommodationId: 31, cursor: "cursor-1", size: 20 },
      signal,
    });
  });

  it("maps accommodation commands to the exact backend paths and bodies", async () => {
    const { transport, request, requestNullable } = createTransport();
    const api = createWishlistApi(transport);
    const signal = new AbortController().signal;
    request.mockResolvedValueOnce({ id: 91 }).mockResolvedValueOnce({ id: 91 });
    requestNullable.mockResolvedValue(null);

    await api.addAccommodation(7, { accommodationId: 31 }, { signal });
    await api.updateAccommodationMemo(91, { memo: "창가 방" }, { signal });
    await api.removeAccommodation(91, { signal });
    await api.delete(7, { signal });

    expect(request).toHaveBeenNthCalledWith(1, {
      method: "POST",
      path: "/members/wishlists/accommodations/7",
      body: { accommodation_id: 31 },
      signal,
    });
    expect(request).toHaveBeenNthCalledWith(2, {
      method: "PATCH",
      path: "/members/wishlists/accommodations/91",
      body: { memo: "창가 방" },
      signal,
    });
    expect(requestNullable).toHaveBeenNthCalledWith(1, {
      method: "DELETE",
      path: "/members/wishlists/accommodations/91",
      signal,
    });
    expect(requestNullable).toHaveBeenNthCalledWith(2, {
      method: "DELETE",
      path: "/members/wishlists/7",
      signal,
    });
  });

  it("maps wishlist detail pagination and response fields", async () => {
    const { transport, request } = createTransport();
    const api = createWishlistApi(transport);
    request.mockResolvedValue({
      wishlist_accommodations: [],
      page_info: { has_next: true, next_cursor: "next", current_size: 0 },
    });

    await expect(
      api.getWishlistAccommodations(7, { cursor: "cursor-1", size: 20 }),
    ).resolves.toEqual({
      accommodations: [],
      pageInfo: { hasNext: true, nextCursor: "next", currentSize: 0 },
    });

    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/members/wishlists/accommodations/7",
      params: { cursor: "cursor-1", size: 20 },
      signal: undefined,
    });
  });
});
