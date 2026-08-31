import type { Mocked } from "vitest";
import type { InfiniteData } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  RecentlyViewedCollection,
  WishlistCollection,
  WishlistDetail,
  WishlistSummary,
} from "../../features/wishlist/model";
import { WISHLIST_REFRESH_WARNING_MESSAGE } from "../../features/wishlist/components/wishlistErrorMessage";
import {
  useRecentlyViewedReadQuery,
  useWishlistDetailReadQuery,
  useWishlistListsReadQuery,
} from "../../features/wishlist/queries";
import { OverlayProvider } from "../../app/overlays/OverlayProvider";
import { requireDefined } from "../../test/assertions";
import { useIntersectionLoadMore } from "../../shared/lib/useIntersectionLoadMore";
import {
  useWishlistMembership,
  type WishlistMembershipCommands,
} from "../../workflows/wishlist-membership";
import { WishlistController } from "./WishlistController";
import type { WishlistControllerProps } from "./WishlistController";

vi.mock("../../features/wishlist/queries", () => ({
  useRecentlyViewedReadQuery: vi.fn(),
  useWishlistDetailReadQuery: vi.fn(),
  useWishlistListsReadQuery: vi.fn(),
}));

vi.mock("../../workflows/wishlist-membership", () => ({
  useWishlistMembership: vi.fn(),
}));

vi.mock("../../shared/lib/useIntersectionLoadMore", () => ({
  useIntersectionLoadMore: vi.fn(() => vi.fn()),
}));

vi.mock("../../features/wishlist/components/WishlistModal", () => ({
  WishlistModal: ({
    accommodationId,
    isOpen,
    onClose,
  }: {
    accommodationId: number;
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div aria-label="위시리스트에 저장하기" role="dialog">
        <span>{accommodationId}</span>
        <button onClick={onClose} type="button">
          저장 모달 닫기
        </button>
      </div>
    ) : null,
}));

const mockUseRecentlyViewedReadQuery = vi.mocked(useRecentlyViewedReadQuery);
const mockUseWishlistDetailReadQuery = vi.mocked(useWishlistDetailReadQuery);
const mockUseWishlistListsReadQuery = vi.mocked(useWishlistListsReadQuery);
const mockUseIntersectionLoadMore = vi.mocked(useIntersectionLoadMore);
const mockUseWishlistMembership = vi.mocked(useWishlistMembership);

const scope = {
  epoch: 3,
  subject: "session:test",
} as unknown as WishlistControllerProps["scope"];

const pageInfo = {
  currentSize: 0,
  hasNext: false,
  nextCursor: null,
} as const;

const wishlist = (id: number, name: string): WishlistSummary => ({
  containsAccommodation: null,
  createdAt: "2026-08-01T00:00:00Z",
  id,
  itemCount: 1,
  name,
  thumbnailImageUrl: null,
  wishlistAccommodationId: null,
});

const wishlistPages = (
  pages: ReadonlyArray<ReadonlyArray<WishlistSummary>>,
): InfiniteData<WishlistCollection, string | null> => ({
  pageParams: pages.map((_, index) => (index === 0 ? null : `page-${index}`)),
  pages: pages.map((wishlists) => ({
    pageInfo: { ...pageInfo, currentSize: wishlists.length },
    wishlists,
  })),
});

const detailPages: InfiniteData<WishlistDetail, string | null> = {
  pageParams: [null],
  pages: [
    {
      accommodations: [
        {
          accommodation: {
            id: 201,
            name: "Lake cabin",
            thumbnailUrl: null,
          },
          addressSummary: {
            city: "춘천",
            country: "대한민국",
            district: "남산면",
            state: null,
          },
          createdAt: "2026-08-02T00:00:00Z",
          isInWishlist: true,
          memo: "Pack sunscreen",
          reviewSummary: { averageRating: 4.5, totalCount: 2 },
          wishlistAccommodationId: 501,
        },
      ],
      pageInfo: { ...pageInfo, currentSize: 1 },
    },
  ],
};

const recentlyViewed: RecentlyViewedCollection = {
  accommodations: [
    {
      accommodationId: 101,
      accommodationName: "Ocean house",
      addressSummary: {
        city: "부산",
        country: "대한민국",
        district: "해운대구",
        state: null,
      },
      isInWishlist: false,
      reviewSummary: { averageRating: 4.8, totalCount: 12 },
      thumbnailUrl: null,
      viewedAt: "2026-08-03T00:00:00Z",
    },
  ],
  totalCount: 1,
};

const queryBase = {
  error: null,
  errorUpdatedAt: 0,
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  isError: false,
  isFetchingNextPage: false,
  isPending: false,
};

const navigation = () => ({
  openAccommodation: vi.fn(),
  openIndex: vi.fn(),
  openRecentlyViewed: vi.fn(),
  openWishlistDetail: vi.fn(),
  replaceWithIndex: vi.fn(),
});

const commands = (): Mocked<WishlistMembershipCommands> => ({
  addAccommodation: vi.fn().mockResolvedValue({
    isInAnyWishlist: true,
    status: "applied",
  }),
  createAndAddAccommodation: vi.fn().mockResolvedValue({
    isInAnyWishlist: true,
    status: "applied",
    wishlistId: 42,
  }),
  deleteWishlist: vi.fn().mockResolvedValue({ status: "applied" }),
  dispose: vi.fn(),
  removeAccommodation: vi.fn().mockResolvedValue({
    isInAnyWishlist: false,
    status: "applied",
  }),
  removeRecentlyViewed: vi.fn().mockResolvedValue({ status: "applied" }),
  saveMemo: vi.fn().mockResolvedValue({ status: "applied" }),
});

const renderController = (
  props: Pick<WishlistControllerProps, "navigation" | "view">,
) =>
  render(
    <OverlayProvider>
      <WishlistController {...props} scope={scope} />
    </OverlayProvider>,
  );

describe("WishlistController", () => {
  let membershipCommands: Mocked<WishlistMembershipCommands>;

  beforeEach(() => {
    vi.clearAllMocks();
    membershipCommands = commands();
    mockUseWishlistMembership.mockReturnValue(membershipCommands);
    mockUseWishlistListsReadQuery.mockReturnValue({
      ...queryBase,
      data: wishlistPages([
        [wishlist(1, "First page")],
        [wishlist(42, "Exact loaded name")],
      ]),
    } as unknown as ReturnType<typeof useWishlistListsReadQuery>);
    mockUseWishlistDetailReadQuery.mockReturnValue({
      ...queryBase,
      data: detailPages,
    } as unknown as ReturnType<typeof useWishlistDetailReadQuery>);
    mockUseRecentlyViewedReadQuery.mockReturnValue({
      ...queryBase,
      data: recentlyViewed,
    } as unknown as ReturnType<typeof useRecentlyViewedReadQuery>);
  });

  it("renders the route-derived view directly without mirroring it locally", () => {
    const commands = navigation();
    const { rerender } = renderController({
      navigation: commands,
      view: { kind: "index" },
    });

    expect(
      screen.getByRole("heading", { name: "위시리스트" }),
    ).toBeInTheDocument();

    rerender(
      <OverlayProvider>
        <WishlistController
          navigation={commands}
          scope={scope}
          view={{ kind: "recently-viewed" }}
        />
      </OverlayProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "최근 조회" }),
    ).toBeInTheDocument();

    rerender(
      <OverlayProvider>
        <WishlistController
          navigation={commands}
          scope={scope}
          view={{ kind: "wishlist-detail", wishlistId: 42 }}
        />
      </OverlayProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "Exact loaded name" }),
    ).toBeInTheDocument();
    expect(mockUseWishlistDetailReadQuery).toHaveBeenLastCalledWith({
      enabled: true,
      scope,
      wishlistId: 42,
    });
    expect(commands.openIndex).not.toHaveBeenCalled();
    expect(commands.openRecentlyViewed).not.toHaveBeenCalled();
    expect(commands.openWishlistDetail).not.toHaveBeenCalled();
    expect(commands.replaceWithIndex).not.toHaveBeenCalled();
  });

  it("enables only the reads required by each route view", () => {
    const routeCommands = navigation();
    const { rerender } = renderController({
      navigation: routeCommands,
      view: { kind: "index" },
    });

    expect(mockUseWishlistListsReadQuery).toHaveBeenLastCalledWith({
      enabled: true,
      scope,
    });
    expect(mockUseRecentlyViewedReadQuery).toHaveBeenLastCalledWith({
      enabled: true,
      scope,
    });
    expect(mockUseWishlistDetailReadQuery).toHaveBeenLastCalledWith({
      enabled: false,
      scope,
      wishlistId: null,
    });

    rerender(
      <OverlayProvider>
        <WishlistController
          navigation={routeCommands}
          scope={scope}
          view={{ kind: "recently-viewed" }}
        />
      </OverlayProvider>,
    );

    expect(mockUseWishlistListsReadQuery).toHaveBeenLastCalledWith({
      enabled: false,
      scope,
    });
    expect(mockUseRecentlyViewedReadQuery).toHaveBeenLastCalledWith({
      enabled: true,
      scope,
    });
    expect(mockUseWishlistDetailReadQuery).toHaveBeenLastCalledWith({
      enabled: false,
      scope,
      wishlistId: null,
    });

    rerender(
      <OverlayProvider>
        <WishlistController
          navigation={routeCommands}
          scope={scope}
          view={{ kind: "wishlist-detail", wishlistId: 42 }}
        />
      </OverlayProvider>,
    );

    expect(mockUseWishlistListsReadQuery).toHaveBeenLastCalledWith({
      enabled: true,
      scope,
    });
    expect(mockUseRecentlyViewedReadQuery).toHaveBeenLastCalledWith({
      enabled: false,
      scope,
    });
    expect(mockUseWishlistDetailReadQuery).toHaveBeenLastCalledWith({
      enabled: true,
      scope,
      wishlistId: 42,
    });
  });

  it("does not surface failures from reads disabled for the current view", () => {
    mockUseWishlistListsReadQuery.mockReturnValue({
      ...queryBase,
      error: { code: "W001" },
      errorUpdatedAt: 1,
      isError: true,
    } as unknown as ReturnType<typeof useWishlistListsReadQuery>);
    mockUseWishlistDetailReadQuery.mockReturnValue({
      ...queryBase,
      error: { code: "W002" },
      errorUpdatedAt: 1,
      isError: true,
    } as unknown as ReturnType<typeof useWishlistDetailReadQuery>);

    renderController({
      navigation: navigation(),
      view: { kind: "recently-viewed" },
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not surface a recently-viewed failure on a detail view", () => {
    mockUseRecentlyViewedReadQuery.mockReturnValue({
      ...queryBase,
      error: { code: "W001" },
      errorUpdatedAt: 1,
      isError: true,
    } as unknown as ReturnType<typeof useRecentlyViewedReadQuery>);

    renderController({
      navigation: navigation(),
      view: { kind: "wishlist-detail", wishlistId: 42 },
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears an old query failure after its read becomes inactive", async () => {
    mockUseWishlistListsReadQuery.mockReturnValue({
      ...queryBase,
      error: { code: "W001" },
      errorUpdatedAt: 1,
      isError: true,
    } as unknown as ReturnType<typeof useWishlistListsReadQuery>);
    const routeCommands = navigation();
    const { rerender } = renderController({
      navigation: routeCommands,
      view: { kind: "index" },
    });

    expect(await screen.findByRole("alert")).toBeInTheDocument();

    rerender(
      <OverlayProvider>
        <WishlistController
          navigation={routeCommands}
          scope={scope}
          view={{ kind: "recently-viewed" }}
        />
      </OverlayProvider>,
    );

    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });

  it("keeps repeated index intersection loads on the active next-page request", () => {
    const fetchNextPage = vi.fn().mockResolvedValue(undefined);
    mockUseWishlistListsReadQuery.mockReturnValue({
      ...queryBase,
      data: wishlistPages([[wishlist(1, "First page")]]),
      fetchNextPage,
      hasNextPage: true,
    } as unknown as ReturnType<typeof useWishlistListsReadQuery>);

    renderController({ navigation: navigation(), view: { kind: "index" } });

    const loadMoreOptions = mockUseIntersectionLoadMore.mock.calls
      .map(([options]) => options)
      .find((options) => !options.disabled && options.hasNext);
    expect(loadMoreOptions).toBeDefined();

    loadMoreOptions?.onLoadMore();
    loadMoreOptions?.onLoadMore();

    expect(fetchNextPage).toHaveBeenNthCalledWith(1, {
      cancelRefetch: false,
    });
    expect(fetchNextPage).toHaveBeenNthCalledWith(2, {
      cancelRefetch: false,
    });
  });

  it("keeps repeated detail intersection loads on the active next-page request", () => {
    const fetchNextPage = vi.fn().mockResolvedValue(undefined);
    mockUseWishlistDetailReadQuery.mockReturnValue({
      ...queryBase,
      data: detailPages,
      fetchNextPage,
      hasNextPage: true,
    } as unknown as ReturnType<typeof useWishlistDetailReadQuery>);

    renderController({
      navigation: navigation(),
      view: { kind: "wishlist-detail", wishlistId: 42 },
    });

    const loadMoreOptions = mockUseIntersectionLoadMore.mock.calls
      .map(([options]) => options)
      .find((options) => !options.disabled && options.hasNext);
    expect(loadMoreOptions).toBeDefined();

    loadMoreOptions?.onLoadMore();
    loadMoreOptions?.onLoadMore();

    expect(fetchNextPage).toHaveBeenNthCalledWith(1, {
      cancelRefetch: false,
    });
    expect(fetchNextPage).toHaveBeenNthCalledWith(2, {
      cancelRefetch: false,
    });
  });

  it("continues collection pagination until a direct detail route name is recovered", async () => {
    const fetchNextPage = vi.fn().mockResolvedValue(undefined);
    const firstPage = wishlistPages([[wishlist(1, "First page")]]);
    mockUseWishlistListsReadQuery.mockReturnValue({
      ...queryBase,
      data: firstPage,
      fetchNextPage,
      hasNextPage: true,
    } as unknown as ReturnType<typeof useWishlistListsReadQuery>);
    const routeCommands = navigation();
    const { rerender } = renderController({
      navigation: routeCommands,
      view: { kind: "wishlist-detail", wishlistId: 42 },
    });

    await waitFor(() => expect(fetchNextPage).toHaveBeenCalledTimes(1));

    mockUseWishlistListsReadQuery.mockReturnValue({
      ...queryBase,
      data: wishlistPages([
        [wishlist(1, "First page")],
        [wishlist(42, "Recovered exact name")],
      ]),
      fetchNextPage,
      hasNextPage: false,
    } as unknown as ReturnType<typeof useWishlistListsReadQuery>);
    rerender(
      <OverlayProvider>
        <WishlistController
          navigation={routeCommands}
          scope={scope}
          view={{ kind: "wishlist-detail", wishlistId: 42 }}
        />
      </OverlayProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Recovered exact name" }),
    ).toBeInTheDocument();
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("surfaces a direct detail name-recovery pagination failure", async () => {
    const fetchNextPage = vi.fn().mockRejectedValue({ code: "W002" });
    mockUseWishlistListsReadQuery.mockReturnValue({
      ...queryBase,
      data: wishlistPages([[wishlist(1, "First page")]]),
      fetchNextPage,
      hasNextPage: true,
    } as unknown as ReturnType<typeof useWishlistListsReadQuery>);

    renderController({
      navigation: navigation(),
      view: { kind: "wishlist-detail", wishlistId: 42 },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "위시리스트에 대한 접근 권한이 없습니다.",
    );
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("replaces a now-deleted selected detail route using the latest route view", async () => {
    let resolveDelete!: (result: { readonly status: "applied" }) => void;
    membershipCommands.deleteWishlist.mockReturnValue(
      new Promise((resolve) => {
        resolveDelete = resolve;
      }),
    );
    const routeCommands = navigation();
    const { rerender } = renderController({
      navigation: routeCommands,
      view: { kind: "index" },
    });

    await userEvent.click(
      requireDefined(
        screen.getAllByRole("button", { name: "위시리스트 삭제" })[1],
        "second delete wishlist button",
      ),
    );

    rerender(
      <OverlayProvider>
        <WishlistController
          navigation={routeCommands}
          scope={scope}
          view={{ kind: "wishlist-detail", wishlistId: 42 }}
        />
      </OverlayProvider>,
    );

    await act(async () => resolveDelete({ status: "applied" }));

    expect(membershipCommands.deleteWishlist).toHaveBeenCalledWith({
      wishlistId: 42,
    });
    expect(routeCommands.replaceWithIndex).toHaveBeenCalledTimes(1);
  });

  it("disables duplicate mutation controls while their command is pending", async () => {
    let resolveDelete!: (result: { readonly status: "applied" }) => void;
    membershipCommands.deleteWishlist.mockReturnValue(
      new Promise((resolve) => {
        resolveDelete = resolve;
      }),
    );
    const routeCommands = navigation();
    renderController({ navigation: routeCommands, view: { kind: "index" } });
    const deleteButton = requireDefined(
      screen.getAllByRole("button", { name: "위시리스트 삭제" })[1],
      "second delete wishlist button",
    );

    await userEvent.click(deleteButton);

    expect(deleteButton).toBeDisabled();
    await userEvent.click(deleteButton);
    expect(membershipCommands.deleteWishlist).toHaveBeenCalledTimes(1);

    await act(async () => resolveDelete({ status: "applied" }));
    await waitFor(() => expect(deleteButton).toBeEnabled());
  });

  it("saves an empty memo as an explicit clearing command", async () => {
    renderController({
      navigation: navigation(),
      view: { kind: "wishlist-detail", wishlistId: 42 },
    });

    await userEvent.click(
      screen.getByRole("button", { name: /Pack sunscreen/ }),
    );
    const memo = screen.getByRole("textbox", { name: "메모" });
    await userEvent.clear(memo);
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(membershipCommands.saveMemo).toHaveBeenCalledWith({
        memo: "",
        wishlistAccommodationId: 501,
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "메모 추가" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("keeps a newer memo draft open when an older save completes late", async () => {
    let resolveSave!: (result: { readonly status: "applied" }) => void;
    const pendingSave = new Promise<{ readonly status: "applied" }>(
      (resolve) => {
        resolveSave = resolve;
      },
    );
    membershipCommands.saveMemo.mockReturnValue(pendingSave);
    renderController({
      navigation: navigation(),
      view: { kind: "wishlist-detail", wishlistId: 42 },
    });

    await userEvent.click(
      screen.getByRole("button", { name: /Pack sunscreen/ }),
    );
    const memo = screen.getByRole("textbox", { name: "메모" });
    await userEvent.clear(memo);
    await userEvent.type(memo, "제출한 메모");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() =>
      expect(membershipCommands.saveMemo).toHaveBeenCalledWith({
        memo: "제출한 메모",
        wishlistAccommodationId: 501,
      }),
    );

    await userEvent.clear(memo);
    await userEvent.type(memo, "더 최신인 초안");
    await act(async () => {
      resolveSave({ status: "applied" });
      await pendingSave;
    });

    expect(screen.getByRole("dialog", { name: "메모 추가" })).toBeVisible();
    expect(memo).toHaveValue("더 최신인 초안");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "저장" })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: "✕" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "메모 추가" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("keeps a reopened memo dialog open when an earlier generation completes late", async () => {
    let resolveSave!: (result: { readonly status: "applied" }) => void;
    const pendingSave = new Promise<{ readonly status: "applied" }>(
      (resolve) => {
        resolveSave = resolve;
      },
    );
    membershipCommands.saveMemo.mockReturnValue(pendingSave);
    renderController({
      navigation: navigation(),
      view: { kind: "wishlist-detail", wishlistId: 42 },
    });

    const openMemo = screen.getByRole("button", { name: /Pack sunscreen/ });
    await userEvent.click(openMemo);
    await userEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() =>
      expect(membershipCommands.saveMemo).toHaveBeenCalledTimes(1),
    );

    await userEvent.click(screen.getByRole("button", { name: "✕" }));
    await userEvent.click(openMemo);
    expect(screen.getByRole("textbox", { name: "메모" })).toHaveValue(
      "Pack sunscreen",
    );

    await act(async () => {
      resolveSave({ status: "applied" });
      await pendingSave;
    });

    expect(screen.getByRole("dialog", { name: "메모 추가" })).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "저장" })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: "✕" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "메모 추가" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("warns without retrying after removal succeeds but reconciliation is unconfirmed", async () => {
    membershipCommands.removeAccommodation.mockResolvedValue({
      status: "applied-unconfirmed",
      error: new Error("refresh failed"),
    });
    renderController({
      navigation: navigation(),
      view: { kind: "wishlist-detail", wishlistId: 42 },
    });

    await userEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      WISHLIST_REFRESH_WARNING_MESSAGE,
    );
    expect(membershipCommands.removeAccommodation).toHaveBeenCalledTimes(1);
  });

  it("surfaces scoped query failures through the screen error boundary", async () => {
    mockUseWishlistListsReadQuery.mockReturnValue({
      ...queryBase,
      error: { code: "W001" },
      errorUpdatedAt: 1,
      isError: true,
    } as unknown as ReturnType<typeof useWishlistListsReadQuery>);

    renderController({ navigation: navigation(), view: { kind: "index" } });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "존재하지 않는 위시리스트입니다.",
    );
  });
});
