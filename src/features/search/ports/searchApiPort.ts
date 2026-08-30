import type {
  SearchApiRequestOptions,
  SearchRequest,
  SearchResultPage,
} from "../model/search";

export interface SearchApiPort {
  search(
    request: SearchRequest,
    options?: SearchApiRequestOptions,
  ): Promise<SearchResultPage>;
}
