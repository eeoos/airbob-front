import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { RecentlyViewedAccommodationInfo } from "../../../types/recentlyViewed";
import {
  WishlistAccommodationInfo,
  WishlistInfo,
} from "../../../types/wishlist";
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

const noopObserver = jest.fn();

const makeWishlist = (overrides: Partial<WishlistInfo> = {}): WishlistInfo => ({
  id: 42,
  name: "Weekend saves",
  created_at: "2026-07-01T00:00:00Z",
  is_contained: null,
  thumbnail_image_url: null,
  wishlist_accommodation_id: null,
  wishlist_item_count: 2,
  ...overrides,
});

const makeWishlistCard = (
  overrides: Partial<WishlistInfo> = {},
): WishlistIndexCardViewModel => toWishlistIndexCardViewModel(makeWishlist(overrides));

const makeRecentlyViewed = (
  overrides: Partial<RecentlyViewedAccommodationInfo> = {}
): RecentlyViewedAccommodationInfo => ({
  accommodation_id: 101,
  accommodation_name: "Ocean house",
  address_summary: {
    country: "대한민국",
    state: null,
    city: "부산",
    district: "해운대구",
  },
  is_in_wishlist: false,
  review_summary: {
    average_rating: 4.8,
    total_count: 12,
  },
  thumbnail_url: "/ocean-house.jpg",
  viewed_at: "2026-07-04T00:00:00Z",
  ...overrides,
});

const makeRecentlyViewedCard = (
  overrides: Partial<RecentlyViewedAccommodationInfo> = {},
): RecentlyViewedAccommodationCardViewModel =>
  toRecentlyViewedAccommodationCardViewModel(makeRecentlyViewed(overrides));

const makeWishlistAccommodation = (
  overrides: Partial<WishlistAccommodationInfo> = {}
): WishlistAccommodationInfo => ({
  wishlist_accommodation_id: 501,
  accommodation: {
    id: 201,
    name: "Lake cabin",
    thumbnail_url: "/lake-cabin.jpg",
  },
  address_summary: {
    country: "대한민국",
    state: null,
    city: "춘천",
    district: "남산면",
  },
  created_at: "2026-07-01T00:00:00Z",
  is_in_wishlist: true,
  memo: null,
  review_summary: {
    average_rating: 4.5,
    total_count: 8,
  },
  ...overrides,
});

const makeWishlistAccommodationCard = (
  overrides: Partial<WishlistAccommodationInfo> = {},
): WishlistAccommodationCardViewModel =>
  toWishlistAccommodationCardViewModel(makeWishlistAccommodation(overrides));

const expectNoNestedInteractiveControls = (container: HTMLElement) => {
  expect(container.querySelector("button button")).toBeNull();
  expect(container.querySelector('[role="button"] button')).toBeNull();
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

    const { container } = renderWishlistIndex({
      onDeleteWishlist,
      onOpenWishlist,
      wishlists: [makeWishlistCard()],
    });

    await userEvent.click(screen.getByRole("button", { name: "위시리스트 삭제" }));

    expect(onDeleteWishlist).toHaveBeenCalledWith(42, expect.any(Object));
    expect(onOpenWishlist).not.toHaveBeenCalled();
    expectNoNestedInteractiveControls(container);
  });

  it("does not open an accommodation card when deleting a wishlist accommodation", async () => {
    const onOpenAccommodationDetail = jest.fn();
    const onRemoveFromWishlist = jest.fn();

    const { container } = renderWishlistDetail({
      onOpenAccommodationDetail,
      onRemoveFromWishlist,
      wishlistAccommodations: [makeWishlistAccommodationCard()],
    });

    await userEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(onRemoveFromWishlist).toHaveBeenCalledWith(501);
    expect(onOpenAccommodationDetail).not.toHaveBeenCalled();
    expectNoNestedInteractiveControls(container);
  });

  it("shows the image fallback when a wishlist detail thumbnail fails to load", () => {
    renderWishlistDetail({
      wishlistAccommodations: [makeWishlistAccommodationCard()],
    });

    const image = screen.getByRole("img", { name: "Lake cabin" });
    const placeholder = image.nextElementSibling as HTMLElement;

    expect(placeholder).toHaveTextContent("이미지 없음");
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

    const { container } = renderRecentlyViewed({
      isEditMode: true,
      onOpenAccommodationDetail,
      onRemoveRecentlyViewed,
      recentlyViewed: [makeRecentlyViewedCard()],
    });

    await userEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(onRemoveRecentlyViewed).toHaveBeenCalledWith(101);
    expect(onOpenAccommodationDetail).not.toHaveBeenCalled();
    expectNoNestedInteractiveControls(container);
  });

  it("does not open a recently viewed card when toggling wishlist state", async () => {
    const onOpenAccommodationDetail = jest.fn();
    const onWishlistToggle = jest.fn();

    const { container } = renderRecentlyViewed({
      onOpenAccommodationDetail,
      onWishlistToggle,
      recentlyViewed: [makeRecentlyViewedCard()],
    });

    await userEvent.click(screen.getByRole("button", { name: "위시리스트" }));

    expect(onWishlistToggle).toHaveBeenCalledWith(101);
    expect(onOpenAccommodationDetail).not.toHaveBeenCalled();
    expectNoNestedInteractiveControls(container);
  });

  it("keeps card actions and nested controls separate", () => {
    const { container: indexContainer } = renderWishlistIndex({
      recentlyViewedSummaryLabel: "오늘",
      wishlists: [makeWishlistCard()],
    });
    expectNoNestedInteractiveControls(indexContainer);

    const { container: detailContainer } = renderWishlistDetail({
      wishlistAccommodations: [makeWishlistAccommodationCard()],
    });
    expectNoNestedInteractiveControls(detailContainer);

    const { container: recentlyViewedContainer } = renderRecentlyViewed({
      recentlyViewed: [makeRecentlyViewedCard()],
    });
    expectNoNestedInteractiveControls(recentlyViewedContainer);
  });
});
