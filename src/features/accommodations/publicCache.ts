import type { QueryClient } from "@tanstack/react-query";
import { accommodationQueryKeys } from "./queryKeys";

export const invalidateAccommodationReviewCaches = (
  queryClient: QueryClient,
  accommodationId: number | string,
) =>
  queryClient.invalidateQueries({
    queryKey: accommodationQueryKeys.reviewsRoot(String(accommodationId)),
  });

export const invalidateAccommodationDetailCaches = (
  queryClient: QueryClient,
) =>
  queryClient.invalidateQueries({
    queryKey: accommodationQueryKeys.detailRoot,
  });
