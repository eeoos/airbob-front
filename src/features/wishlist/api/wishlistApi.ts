import type {
  AddWishlistAccommodationWireRequest,
  CreateWishlistWireRequest,
  IdentifierWire,
  UpdateWishlistAccommodationMemoWireRequest,
  WishlistCollectionWire,
  WishlistDetailWire,
  WishlistMembershipWire,
} from "./contracts";
import { platformApiTransport, type ApiTransport } from "./transport";
import { toWishlistCollection, toWishlistDetail } from "./mappers";
import type { WishlistApiPort } from "../ports/wishlistApiPort";

const createWishlistApi = (transport: ApiTransport): WishlistApiPort => ({
  async getAccommodationMembership(params, options) {
    const wire = await transport.request<WishlistMembershipWire>({
      method: "GET",
      path: "/members/wishlists/membership",
      params,
      signal: options?.signal,
    });
    if (
      typeof wire.is_in_any_wishlist !== "boolean" ||
      typeof wire.target_wishlist_found !== "boolean" ||
      (wire.target_wishlist_found
        ? typeof wire.target_wishlist_contains !== "boolean"
        : wire.target_wishlist_contains !== null)
    ) {
      throw new TypeError("Wishlist membership response is invalid.");
    }
    return {
      isInAnyWishlist: wire.is_in_any_wishlist,
      targetWishlistContains: wire.target_wishlist_contains,
      targetWishlistFound: wire.target_wishlist_found,
    };
  },
  async create(input, options) {
    const body: CreateWishlistWireRequest = { name: input.name };
    return transport.request<IdentifierWire>({
      method: "POST",
      path: "/members/wishlists",
      body,
      signal: options?.signal,
    });
  },

  async delete(wishlistId, options) {
    await transport.requestNullable<never>({
      method: "DELETE",
      path: `/members/wishlists/${wishlistId}`,
      signal: options?.signal,
    });
  },

  async getWishlists(params, options) {
    const wire = await transport.request<WishlistCollectionWire>({
      method: "GET",
      path: "/members/wishlists",
      ...(params ? { params } : {}),
      signal: options?.signal,
    });

    return toWishlistCollection(wire);
  },

  async addAccommodation(wishlistId, input, options) {
    const body: AddWishlistAccommodationWireRequest = {
      accommodation_id: input.accommodationId,
    };
    return transport.request<IdentifierWire>({
      method: "POST",
      path: `/members/wishlists/accommodations/${wishlistId}`,
      body,
      signal: options?.signal,
    });
  },

  async updateAccommodationMemo(wishlistAccommodationId, input, options) {
    const body: UpdateWishlistAccommodationMemoWireRequest = {
      memo: input.memo,
    };
    return transport.request<IdentifierWire>({
      method: "PATCH",
      path: `/members/wishlists/accommodations/${wishlistAccommodationId}`,
      body,
      signal: options?.signal,
    });
  },

  async removeAccommodation(wishlistAccommodationId, options) {
    await transport.requestNullable<never>({
      method: "DELETE",
      path: `/members/wishlists/accommodations/${wishlistAccommodationId}`,
      signal: options?.signal,
    });
  },

  async getWishlistAccommodations(wishlistId, params, options) {
    const wire = await transport.request<WishlistDetailWire>({
      method: "GET",
      path: `/members/wishlists/accommodations/${wishlistId}`,
      ...(params ? { params } : {}),
      signal: options?.signal,
    });

    return toWishlistDetail(wire);
  },
});

export const wishlistApi = createWishlistApi(platformApiTransport);
