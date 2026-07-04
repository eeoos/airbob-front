import { useQuery } from "@tanstack/react-query";
import { recentlyViewedApi } from "../../../api";
import { RecentlyViewedAccommodationInfos } from "../../../types/recentlyViewed";
import { wishlistQueryKeys } from "../queryKeys";

export function useRecentlyViewedQuery() {
  return useQuery<
    RecentlyViewedAccommodationInfos,
    unknown,
    RecentlyViewedAccommodationInfos,
    ReturnType<typeof wishlistQueryKeys.recentlyViewed>
  >({
    queryKey: wishlistQueryKeys.recentlyViewed(),
    queryFn: () => recentlyViewedApi.getRecentlyViewed(),
    throwOnError: false,
  });
}
