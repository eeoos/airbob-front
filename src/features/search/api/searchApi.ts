import { requestApiData } from "../../../platform/http/request";
import { normalizeSearchRequest } from "../lib/searchRequest";
import type { SearchApiPort } from "../ports/searchApiPort";
import type { SearchResultPageWire } from "./contracts";
import { toSearchResultPage, toSearchWireRequest } from "./mappers";

type SearchApiTransport = typeof requestApiData;

const createSearchApi = (request: SearchApiTransport): SearchApiPort => ({
  async search(searchRequest, options) {
    const params = toSearchWireRequest(normalizeSearchRequest(searchRequest));
    const wire = await request<SearchResultPageWire>({
      method: "GET",
      path: "/search/accommodations",
      params,
      signal: options?.signal,
    });

    return toSearchResultPage(wire);
  },
});

export const searchApi = createSearchApi(requestApiData);
