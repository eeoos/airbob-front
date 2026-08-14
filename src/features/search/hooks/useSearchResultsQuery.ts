import {
  keepPreviousData,
  useQuery,
} from "@tanstack/react-query";
import { accommodationApi } from "../../../api/accommodations";
import type {
  AccommodationSearchRequest,
  AccommodationSearchResponse,
} from "../../../types/accommodation";
import { searchQueryKeys } from "../queryKeys";

interface UseSearchResultsQueryOptions {
  enabled: boolean;
  onQueryStart?: () => void;
  searchParamsSignature: string;
  searchRequest: AccommodationSearchRequest;
}

export const useSearchResultsQuery = ({
  enabled,
  onQueryStart,
  searchParamsSignature,
  searchRequest,
}: UseSearchResultsQueryOptions) =>
  useQuery<
    AccommodationSearchResponse,
    unknown,
    AccommodationSearchResponse,
    ReturnType<typeof searchQueryKeys.results>
  >({
    queryKey: searchQueryKeys.results(searchParamsSignature),
    queryFn: ({ signal }) => {
      onQueryStart?.();
      return accommodationApi.search(searchRequest, signal);
    },
    enabled,
    placeholderData: keepPreviousData,
    throwOnError: false,
  });
