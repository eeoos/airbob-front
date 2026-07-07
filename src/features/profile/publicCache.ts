import type { QueryClient } from "@tanstack/react-query";
import { profileQueryKeys } from "./queryKeys";

export const invalidateProfileHostListingCaches = (
  queryClient: QueryClient,
) =>
  queryClient.invalidateQueries({
    queryKey: profileQueryKeys.hostListingsRoot,
  });
