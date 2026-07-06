import type { QueryClient } from "@tanstack/react-query";
import { searchQueryKeys } from "./queryKeys";

export const invalidateSearchResultCaches = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: searchQueryKeys.all });
};
