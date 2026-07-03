export const wishlistQueryKeys = {
  all: ["wishlist"] as const,
  lists: (paramsSignature: string) =>
    [...wishlistQueryKeys.all, "lists", paramsSignature] as const,
  detail: (wishlistId: number) =>
    [...wishlistQueryKeys.all, "detail", wishlistId] as const,
};
