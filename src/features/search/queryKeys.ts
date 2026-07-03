export const searchQueryKeys = {
  all: ["search"] as const,
  results: (paramsSignature: string) =>
    [...searchQueryKeys.all, "results", paramsSignature] as const,
};
