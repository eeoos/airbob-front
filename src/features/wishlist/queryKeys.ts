export const wishlistQueryKeys = {
  all: ["wishlist"] as const,
  lists: (paramsSignature: string) =>
    [...wishlistQueryKeys.all, "lists", paramsSignature] as const,
  detail: (wishlistId: number, paramsSignature = "") =>
    [...wishlistQueryKeys.all, "detail", wishlistId, paramsSignature] as const,
  recentlyViewed: () =>
    [...wishlistQueryKeys.all, "recentlyViewed"] as const,
};
