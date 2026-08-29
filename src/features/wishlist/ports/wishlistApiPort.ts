import type {
  AddWishlistAccommodationInput,
  ApiRequestOptions,
  CreateWishlistInput,
  IdentifierResult,
  UpdateWishlistAccommodationMemoInput,
  WishlistCollection,
  WishlistDetail,
  WishlistDetailParams,
  WishlistListParams,
} from "../model";

export interface WishlistApiPort {
  create(
    input: CreateWishlistInput,
    options?: ApiRequestOptions,
  ): Promise<IdentifierResult>;
  delete(wishlistId: number, options?: ApiRequestOptions): Promise<void>;
  getWishlists(
    params?: WishlistListParams,
    options?: ApiRequestOptions,
  ): Promise<WishlistCollection>;
  addAccommodation(
    wishlistId: number,
    input: AddWishlistAccommodationInput,
    options?: ApiRequestOptions,
  ): Promise<IdentifierResult>;
  updateAccommodationMemo(
    wishlistAccommodationId: number,
    input: UpdateWishlistAccommodationMemoInput,
    options?: ApiRequestOptions,
  ): Promise<IdentifierResult>;
  removeAccommodation(
    wishlistAccommodationId: number,
    options?: ApiRequestOptions,
  ): Promise<void>;
  getWishlistAccommodations(
    wishlistId: number,
    params?: WishlistDetailParams,
    options?: ApiRequestOptions,
  ): Promise<WishlistDetail>;
}
