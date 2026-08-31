import { keepPreviousData } from "@tanstack/react-query";
import type { SessionQueryScope } from "../../../platform/query/sessionScope";
import type { SearchApiPort } from "../ports/searchApiPort";
import { createSearchResultsQueryOptions } from "./searchQueries";

const scope: SessionQueryScope = { subject: null, epoch: 2 };

describe("search read query contracts", () => {
  it("keys and tags the normalized request, keeps prior data and forwards AbortSignal", async () => {
    const signal = new AbortController().signal;
    const api: SearchApiPort = {
      search: vi.fn().mockResolvedValue({
        accommodations: [],
        pageInfo: {
          pageSize: 18,
          currentPage: 0,
          totalPages: 0,
          totalElements: 0,
          isFirst: true,
          isLast: true,
          hasNext: false,
          hasPrevious: false,
        },
      }),
    };
    const options = createSearchResultsQueryOptions(
      {
        scope,
        request: {
          destination: "Seoul",
          adultOccupancy: 1,
          childOccupancy: 0,
          page: 0,
          size: 18,
        },
      },
      api,
    );

    await options.queryFn({ signal });

    expect(options.queryKey).toEqual([
      "search",
      "results",
      {
        destination: "Seoul",
        adultOccupancy: 1,
        childOccupancy: 0,
        page: 0,
        size: 18,
      },
      { session: { subject: null, epoch: 2 } },
    ]);
    expect(options.meta).toEqual({ session: scope });
    expect(options.placeholderData).toBe(keepPreviousData);
    expect(api.search).toHaveBeenCalledWith(
      {
        destination: "Seoul",
        adultOccupancy: 1,
        childOccupancy: 0,
        page: 0,
        size: 18,
      },
      { signal },
    );
  });

  it("preserves explicit disabled policy without changing the semantic key", () => {
    const api = { search: vi.fn() } as unknown as SearchApiPort;
    const request = { destination: "Seoul", page: 2, size: 18 };

    const enabled = createSearchResultsQueryOptions(
      { scope, request },
      api,
    );
    const disabled = createSearchResultsQueryOptions(
      { scope, request, enabled: false },
      api,
    );

    expect(disabled.enabled).toBe(false);
    expect(disabled.queryKey).toEqual(enabled.queryKey);
  });

  it("has no callback channel for query-function UI side effects", () => {
    const options = createSearchResultsQueryOptions(
      {
        scope,
        request: { page: 0, size: 18 },
      },
      { search: vi.fn() } as unknown as SearchApiPort,
    );

    expect(options).not.toHaveProperty("onSuccess");
    expect(options).not.toHaveProperty("onError");
    expect(options).not.toHaveProperty("onQueryStart");
  });
});
