export type WishlistMembershipCommandResult =
  | {
      readonly status: "applied";
      readonly isInAnyWishlist: boolean;
    }
  | {
      readonly status: "applied-unconfirmed";
      readonly error: unknown;
    }
  | { readonly status: "stale" };

export type CreateAndAddWishlistCommandResult =
  | (WishlistMembershipCommandResult & { readonly wishlistId?: number })
  | {
      readonly status: "created-only";
      readonly wishlistId: number;
      readonly error: unknown;
    };

/**
 * Feature-owned write contract implemented by the central membership workflow.
 * Wishlist UI receives this port and never constructs a mutation writer.
 */
export interface WishlistMembershipCommandPort {
  addAccommodation(input: {
    readonly accommodationId: number;
    readonly wishlistId: number;
  }): Promise<WishlistMembershipCommandResult>;
  removeAccommodation(input: {
    readonly accommodationId: number;
    readonly wishlistAccommodationId: number;
  }): Promise<WishlistMembershipCommandResult>;
  createAndAddAccommodation(input: {
    readonly accommodationId: number;
    readonly name: string;
  }): Promise<CreateAndAddWishlistCommandResult>;
}
