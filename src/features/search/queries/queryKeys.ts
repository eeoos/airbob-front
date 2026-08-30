import {
  createSessionQueryMeta,
  type SessionQueryScope,
} from "../../../platform/query/sessionScope";
import { normalizeSearchRequest } from "../lib/searchRequest";
import type { SearchRequest } from "../model/search";

const root = ["search"] as const;

export const searchReadQueryKeys = {
  root,
  results: (scope: SessionQueryScope, request: SearchRequest) =>
    [
      ...root,
      "results",
      normalizeSearchRequest(request),
      createSessionQueryMeta(scope),
    ] as const,
};
