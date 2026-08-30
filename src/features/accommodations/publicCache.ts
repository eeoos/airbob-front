import type { QueryClient } from "@tanstack/react-query";
import { accommodationQueryKeys } from "./queryKeys";

export const invalidateAccommodationDetailCaches = (
  queryClient: QueryClient,
) =>
  queryClient.invalidateQueries({
    queryKey: accommodationQueryKeys.detailRoot,
  });
