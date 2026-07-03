export const profileQueryKeys = {
  all: ["profile"] as const,
  hostListings: (paramsSignature: string) =>
    [...profileQueryKeys.all, "hostListings", paramsSignature] as const,
};
