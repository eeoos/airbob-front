import { toCanonicalSearchString } from "../../shared/lib/urlSearchParams";

type QueryParamsSignature = string;

const toCanonicalQueryKeySignature = (paramsSignature: QueryParamsSignature) =>
  paramsSignature
    ? toCanonicalSearchString(new URLSearchParams(paramsSignature))
    : "";

export const searchQueryKeys = {
  all: ["search"] as const,
  results: (paramsSignature: QueryParamsSignature) =>
    [
      ...searchQueryKeys.all,
      "results",
      toCanonicalQueryKeySignature(paramsSignature),
    ] as const,
};
