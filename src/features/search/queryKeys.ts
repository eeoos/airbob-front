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

export const searchQueryKeys = {
  all: ["search"] as const,
  results: (paramsSignature: QueryParamsSignature) =>
    [
      ...searchQueryKeys.all,
      "results",
      toCanonicalQueryKeySignature(paramsSignature),
    ] as const,
};
