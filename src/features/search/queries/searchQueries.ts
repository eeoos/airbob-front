import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  createSessionQueryMeta,
  type SessionQueryScope,
} from "../../../platform/query/sessionScope";
import { searchApi as defaultSearchApi } from "../api/searchApi";
import { normalizeSearchRequest } from "../lib/searchRequest";
import type { SearchRequest, SearchResultPage } from "../model/search";
import type { SearchApiPort } from "../ports/searchApiPort";
import { searchReadQueryKeys } from "./queryKeys";

export interface SearchResultsQueryOptions {
  readonly scope: SessionQueryScope;
  readonly request: SearchRequest;
  readonly enabled?: boolean;
}

export const createSearchResultsQueryOptions = (
  {
    scope,
    request,
    enabled = true,
  }: SearchResultsQueryOptions,
  api: SearchApiPort = defaultSearchApi,
) => {
  const normalizedRequest = normalizeSearchRequest(request);

  return {
    queryKey: searchReadQueryKeys.results(scope, normalizedRequest),
    queryFn: ({ signal }: { readonly signal: AbortSignal }) =>
      api.search(normalizedRequest, { signal }),
    enabled,
    placeholderData: keepPreviousData,
    meta: createSessionQueryMeta(scope),
    throwOnError: false as const,
  };
};

export const useSearchResultsReadQuery = (
  options: SearchResultsQueryOptions,
) =>
  useQuery<
    SearchResultPage,
    Error,
    SearchResultPage,
    ReturnType<typeof searchReadQueryKeys.results>
  >(createSearchResultsQueryOptions(options));
