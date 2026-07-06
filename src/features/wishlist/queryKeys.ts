import { toCanonicalSearchString } from "../../routes/routeQuery";

type QueryParamsSignature = string | URLSearchParams;

const toCanonicalQueryKeySignature = (
  paramsSignature: QueryParamsSignature,
) => {
  if (typeof paramsSignature === "string") {
    return paramsSignature
      ? toCanonicalSearchString(new URLSearchParams(paramsSignature))
      : "";
  }

  return toCanonicalSearchString(paramsSignature);
};

export const wishlistQueryKeys = {
  all: ["wishlist"] as const,
  lists: (paramsSignature: QueryParamsSignature) =>
    [
      ...wishlistQueryKeys.all,
      "lists",
      toCanonicalQueryKeySignature(paramsSignature),
    ] as const,
  detail: (wishlistId: number, paramsSignature: QueryParamsSignature = "") =>
    [
      ...wishlistQueryKeys.all,
      "detail",
      wishlistId,
      toCanonicalQueryKeySignature(paramsSignature),
    ] as const,
  recentlyViewed: () =>
    [...wishlistQueryKeys.all, "recentlyViewed"] as const,
};
