import { toCanonicalSearchString } from "../../shared/lib/urlSearchParams";

type QueryParamsSignature = string;

const toCanonicalQueryKeySignature = (paramsSignature: QueryParamsSignature) =>
  paramsSignature
    ? toCanonicalSearchString(new URLSearchParams(paramsSignature))
    : "";

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
