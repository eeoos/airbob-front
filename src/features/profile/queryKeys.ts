export const profileQueryKeys = {
  all: ["profile"] as const,
  hostListingsRoot: ["profile", "hostListings"] as const,
  hostListings: (paramsSignature: string) =>
    [...profileQueryKeys.hostListingsRoot, paramsSignature] as const,
};
