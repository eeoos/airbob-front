import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { SessionQueryScope } from "../../../platform/query/sessionScope";
import { requireDefined } from "../../../test/assertions";
import { searchApi } from "../api/searchApi";
import { useSearchResultsReadQuery } from "./searchQueries";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();

  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

interface CapturedQueryOptions {
  readonly queryKey: readonly unknown[];
  readonly queryFn: (context: {
    readonly signal: AbortSignal;
  }) => Promise<unknown>;
  readonly enabled: boolean;
  readonly placeholderData: typeof keepPreviousData;
  readonly meta: unknown;
  readonly throwOnError: false;
}

const mockUseQuery = vi.mocked(useQuery);

const getCapturedOptions = (): CapturedQueryOptions =>
  requireDefined(
    mockUseQuery.mock.calls.at(-1),
    "useQuery call",
  )[0] as unknown as CapturedQueryOptions;

const scope: SessionQueryScope = { subject: null, epoch: 2 };

describe("search read query contracts", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockUseQuery.mockReturnValue({} as ReturnType<typeof useQuery>);
    vi.restoreAllMocks();
  });

  it("keys and tags the normalized request, keeps prior data and forwards AbortSignal", async () => {
    const signal = new AbortController().signal;
    const search = vi.spyOn(searchApi, "search").mockResolvedValue({
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
    });

    useSearchResultsReadQuery({
      scope,
      request: {
        destination: "Seoul",
        adultOccupancy: 1,
        childOccupancy: 0,
        page: 0,
        size: 18,
      },
    });
    const options = getCapturedOptions();

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
    expect(search).toHaveBeenCalledWith(
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
    const request = { destination: "Seoul", page: 2, size: 18 };

    useSearchResultsReadQuery({ scope, request });
    const enabled = getCapturedOptions();
    useSearchResultsReadQuery({ scope, request, enabled: false });
    const disabled = getCapturedOptions();

    expect(disabled.enabled).toBe(false);
    expect(disabled.queryKey).toEqual(enabled.queryKey);
  });

  it("has no callback channel for query-function UI side effects", () => {
    useSearchResultsReadQuery({
      scope,
      request: { page: 0, size: 18 },
    });
    const options = getCapturedOptions();

    expect(options).not.toHaveProperty("onSuccess");
    expect(options).not.toHaveProperty("onError");
    expect(options).not.toHaveProperty("onQueryStart");
  });
});
