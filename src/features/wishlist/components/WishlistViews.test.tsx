import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import type {
  RecentlyViewedAccommodation,
  WishlistAccommodation,
  WishlistSummary,
} from "../model";
import {
  RecentlyViewedAccommodationCardViewModel,
  toRecentlyViewedAccommodationCardViewModel,
  toWishlistAccommodationCardViewModel,
  toWishlistIndexCardViewModel,
  WishlistAccommodationCardViewModel,
  WishlistIndexCardViewModel,
} from "../lib/wishlistAccommodationViewModel";
import { RecentlyViewedView } from "./RecentlyViewedView";
import { WishlistDetailView } from "./WishlistDetailView";
import { WishlistIndexView } from "./WishlistIndexView";
import { WishlistMemoDialog } from "./WishlistMemoDialog";

const noopObserver = jest.fn();

const makeWishlist = (
  overrides: Partial<WishlistSummary> = {},
): WishlistSummary => ({
  id: 42,
  name: "Weekend saves",
  createdAt: "2026-07-01T00:00:00Z",
  containsAccommodation: null,
  thumbnailImageUrl: null,
  wishlistAccommodationId: null,
  itemCount: 2,
  ...overrides,
});

const makeWishlistCard = (
  overrides: Partial<WishlistSummary> = {},
): WishlistIndexCardViewModel => toWishlistIndexCardViewModel(makeWishlist(overrides));

const makeRecentlyViewed = (
  overrides: Partial<RecentlyViewedAccommodation> = {}
): RecentlyViewedAccommodation => ({
  accommodationId: 101,
  accommodationName: "Ocean house",
  addressSummary: {
    country: "대한민국",
    state: null,
    city: "부산",
    district: "해운대구",
  },
  isInWishlist: false,
  reviewSummary: {
    averageRating: 4.8,
    totalCount: 12,
  },
  thumbnailUrl: "/ocean-house.jpg",
  viewedAt: "2026-07-04T00:00:00Z",
  ...overrides,
});

const makeRecentlyViewedCard = (
  overrides: Partial<RecentlyViewedAccommodation> = {},
): RecentlyViewedAccommodationCardViewModel =>
  toRecentlyViewedAccommodationCardViewModel(makeRecentlyViewed(overrides));

const makeWishlistAccommodation = (
  overrides: Partial<WishlistAccommodation> = {}
): WishlistAccommodation => ({
  wishlistAccommodationId: 501,
  accommodation: {
    id: 201,
    name: "Lake cabin",
    thumbnailUrl: "/lake-cabin.jpg",
  },
  addressSummary: {
    country: "대한민국",
    state: null,
    city: "춘천",
    district: "남산면",
  },
  createdAt: "2026-07-01T00:00:00Z",
  isInWishlist: true,
  memo: null,
  reviewSummary: {
    averageRating: 4.5,
    totalCount: 8,
  },
  ...overrides,
});

const makeWishlistAccommodationCard = (
  overrides: Partial<WishlistAccommodation> = {},
): WishlistAccommodationCardViewModel =>
  toWishlistAccommodationCardViewModel(makeWishlistAccommodation(overrides));

const expectNoNestedInteractiveControls = (container: HTMLElement) => {
  // This is a DOM-structure regression guard: nested buttons are invalid even
  // when each control still has an accessible role.
  // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
  expect(container.querySelectorAll("button button")).toHaveLength(0);
  // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
  expect(container.querySelectorAll('[role="button"] button')).toHaveLength(0);
};

const renderWishlistIndex = (
  props: Partial<React.ComponentProps<typeof WishlistIndexView>> = {}
) =>
  render(
    <WishlistIndexView
      isLoading={false}
      isLoadingMoreWishlists={false}
      onDeleteWishlist={jest.fn()}
      onOpenRecentlyViewed={jest.fn()}
      onOpenWishlist={jest.fn()}
      recentlyViewedSummaryLabel="항목 없음"
      setWishlistsObserverTarget={noopObserver}
      wishlists={[]}
      wishlistsHasNext={false}
      {...props}
    />
  );

const renderWishlistDetail = (
  props: Partial<React.ComponentProps<typeof WishlistDetailView>> = {}
) =>
  render(
    <WishlistDetailView
      hasNext={false}
      isLoading={false}
      isLoadingMore={false}
      onBack={jest.fn()}
      onOpenAccommodationDetail={jest.fn()}
      onOpenMemo={jest.fn()}
      onRemoveFromWishlist={jest.fn()}
      selectedWishlistName="Weekend saves"
      setWishlistAccommodationsObserverTarget={noopObserver}
      wishlistAccommodations={[]}
      {...props}
    />
  );

const renderRecentlyViewed = (
  props: Partial<React.ComponentProps<typeof RecentlyViewedView>> = {}
) =>
  render(
    <RecentlyViewedView
      isEditMode={false}
      onBack={jest.fn()}
      onOpenAccommodationDetail={jest.fn()}
      onRemoveRecentlyViewed={jest.fn()}
      onToggleEditMode={jest.fn()}
      onWishlistToggle={jest.fn()}
      recentlyViewed={[]}
      {...props}
    />
  );

describe("Wishlist view components", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading and empty states", () => {
    renderWishlistIndex({ isLoading: true });
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();

    renderWishlistDetail();
    expect(screen.getByText("위시리스트가 비어있습니다.")).toBeInTheDocument();

    renderRecentlyViewed();
    expect(screen.getByText("최근 조회한 숙소가 없습니다.")).toBeInTheDocument();
  });

  it("does not open a wishlist card when deleting the wishlist", async () => {
    const onDeleteWishlist = jest.fn(
      (_wishlistId: number, event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
      }
    );
    const onOpenWishlist = jest.fn();

    renderWishlistIndex({
      onDeleteWishlist,
      onOpenWishlist,
      wishlists: [makeWishlistCard()],
    });

    await userEvent.click(screen.getByRole("button", { name: "위시리스트 삭제" }));

    expect(onDeleteWishlist).toHaveBeenCalledWith(42, expect.any(Object));
    expect(onOpenWishlist).not.toHaveBeenCalled();
  });

  it("does not open an accommodation card when deleting a wishlist accommodation", async () => {
    const onOpenAccommodationDetail = jest.fn();
    const onRemoveFromWishlist = jest.fn();

    renderWishlistDetail({
      onOpenAccommodationDetail,
      onRemoveFromWishlist,
      wishlistAccommodations: [makeWishlistAccommodationCard()],
    });

    await userEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(onRemoveFromWishlist).toHaveBeenCalledWith(501);
    expect(onOpenAccommodationDetail).not.toHaveBeenCalled();
  });

  it("labels the wishlist detail back button for assistive technology", () => {
    renderWishlistDetail();

    const backButton = screen.getByRole("button", {
      name: /뒤로 가기|돌아가기/,
    });

    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveAttribute("type", "button");
  });

  it("labels the recently viewed back button for assistive technology", () => {
    renderRecentlyViewed();

    const backButton = screen.getByRole("button", {
      name: "위시리스트 목록으로 돌아가기",
    });

    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveAttribute("type", "button");
  });

  it("shows the image fallback when a wishlist detail thumbnail fails to load", () => {
    renderWishlistDetail({
      wishlistAccommodations: [makeWishlistAccommodationCard()],
    });

    const image = screen.getByRole("img", { name: "Lake cabin" });
    const placeholder = screen.getByText("이미지 없음");

    expect(placeholder).toHaveStyle({ display: "none" });

    fireEvent.error(image);

    expect(image).toHaveStyle({ display: "none" });
    expect(placeholder).toHaveStyle({ display: "flex" });
  });

  it("opens the memo dialog from a wishlist detail memo button", async () => {
    const item = makeWishlistAccommodationCard({ memo: "Bring coffee" });
    const onOpenAccommodationDetail = jest.fn();
    const onOpenMemo = jest.fn();

    renderWishlistDetail({
      onOpenAccommodationDetail,
      onOpenMemo,
      wishlistAccommodations: [item],
    });

    await userEvent.click(screen.getByRole("button", { name: /Bring coffee/ }));

    expect(onOpenMemo).toHaveBeenCalledWith({
      wishlistAccommodationId: item.wishlistAccommodationId,
      memo: "Bring coffee",
    });
    expect(onOpenAccommodationDetail).not.toHaveBeenCalled();
  });

  it("does not open a recently viewed card when deleting in edit mode", async () => {
    const onOpenAccommodationDetail = jest.fn();
    const onRemoveRecentlyViewed = jest.fn();

    renderRecentlyViewed({
      isEditMode: true,
      onOpenAccommodationDetail,
      onRemoveRecentlyViewed,
      recentlyViewed: [makeRecentlyViewedCard()],
    });

    await userEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(onRemoveRecentlyViewed).toHaveBeenCalledWith(101);
    expect(onOpenAccommodationDetail).not.toHaveBeenCalled();
  });

  it("does not open a recently viewed card when toggling wishlist state", async () => {
    const onOpenAccommodationDetail = jest.fn();
    const onWishlistToggle = jest.fn();

    renderRecentlyViewed({
      onOpenAccommodationDetail,
      onWishlistToggle,
      recentlyViewed: [makeRecentlyViewedCard()],
    });

    await userEvent.click(screen.getByRole("button", { name: "위시리스트" }));

    expect(onWishlistToggle).toHaveBeenCalledWith(101);
    expect(onOpenAccommodationDetail).not.toHaveBeenCalled();
  });

  it("keeps card actions and nested controls separate", () => {
    const { container: indexContainer } = renderWishlistIndex({
      recentlyViewedSummaryLabel: "오늘",
      wishlists: [makeWishlistCard()],
    });
    expect(screen.getByRole("button", { name: "위시리스트 삭제" })).toBeInTheDocument();
    expectNoNestedInteractiveControls(indexContainer);

    const { container: detailContainer } = renderWishlistDetail({
      wishlistAccommodations: [makeWishlistAccommodationCard()],
    });
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
    expectNoNestedInteractiveControls(detailContainer);

    const { container: recentlyViewedContainer } = renderRecentlyViewed({
      recentlyViewed: [makeRecentlyViewedCard()],
    });
    expect(screen.getByRole("button", { name: "위시리스트" })).toBeInTheDocument();
    expectNoNestedInteractiveControls(recentlyViewedContainer);
  });

  it("allows saving an empty memo so an existing memo can be cleared", async () => {
    const onSave = jest.fn();
    render(
      <WishlistMemoDialog
        isOpen
        memoText=""
        onChangeMemoText={jest.fn()}
        onClear={jest.fn()}
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );

    const saveButton = screen.getByRole("button", { name: "저장" });
    expect(saveButton).not.toBeDisabled();

    await userEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
