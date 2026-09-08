import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SearchAccommodationCardViewModel } from "../lib/searchAccommodationViewModel";
import { SearchResultsList } from "./SearchResultsList";

vi.mock("./SearchAccommodationCard", () => ({
  SearchAccommodationCard: ({
    accommodation,
    detailUrl,
    onClick,
  }: {
    accommodation: SearchAccommodationCardViewModel;
    detailUrl?: string;
    onClick: () => void;
  }) => (
    <button type="button" data-detail-url={detailUrl} onClick={onClick}>
      {`숙소 카드 ${accommodation.id}`}
    </button>
  ),
}));

const createAccommodation = (id: number): SearchAccommodationCardViewModel => ({
  id,
  name: `숙소 ${id}`,
  thumbnailUrl: null,
  locationLabel: "Seoul의 아파트",
  showReview: false,
  reviewRatingLabel: "0.0",
  reviewCountLabel: "(0)",
  basePrice: 100000,
  currency: "KRW",
  isInWishlist: false,
});

describe("SearchResultsList", () => {
  it("shows the initial loading state before results are available", () => {
    render(
      <SearchResultsList
        accommodations={[]}
        getAccommodationHref={(id) => `/accommodations/${id}`}
        isLoading={true}
        onAccommodationClick={vi.fn()}
        onWishlistToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "숙소를 찾는 중입니다.",
    );
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-state-kind",
      "loading",
    );
  });

  it("shows an actionable retry state when the first request fails", async () => {
    const onRetry = vi.fn();

    const view = render(
      <SearchResultsList
        accommodations={[]}
        errorMessage="네트워크 연결을 확인한 뒤 다시 시도해주세요."
        getAccommodationHref={(id) => `/accommodations/${id}`}
        isErrorRetryable
        isLoading={false}
        onAccommodationClick={vi.fn()}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "네트워크 연결을 확인한 뒤 다시 시도해주세요.",
    );
    expect(
      screen.getByRole("heading", { name: "숙소를 불러오지 못했어요" }),
    ).toBeVisible();

    screen.getByRole("button", { name: "다시 시도" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("region", { name: "검색 결과 상태" }),
    ).toHaveFocus();

    view.rerender(
      <SearchResultsList
        accommodations={[]}
        getAccommodationHref={(id) => `/accommodations/${id}`}
        isErrorRetryable
        isLoading
        onAccommodationClick={vi.fn()}
        onRetry={onRetry}
      />,
    );

    expect(
      screen.getByRole("region", { name: "검색 결과 상태" }),
    ).toHaveFocus();
  });

  it("renders non-retryable failures without a retry command", () => {
    render(
      <SearchResultsList
        accommodations={[]}
        errorMessage="검색 조건을 확인해주세요."
        getAccommodationHref={(id) => `/accommodations/${id}`}
        isLoading={false}
        onAccommodationClick={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveAttribute(
      "data-state-kind",
      "terminal-error",
    );
    expect(
      screen.queryByRole("button", { name: "다시 시도" }),
    ).not.toBeInTheDocument();
  });

  it("keeps stale cards visible and offers a single inline retry", async () => {
    const onRetry = vi.fn();

    const view = render(
      <SearchResultsList
        accommodations={[createAccommodation(7)]}
        errorMessage="검색 결과를 불러오지 못했습니다."
        getAccommodationHref={(id) => `/accommodations/${id}`}
        isErrorRetryable
        isLoading={false}
        onAccommodationClick={vi.fn()}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("button", { name: "숙소 카드 7" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "새 결과를 불러오지 못했어요",
    );

    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    view.rerender(
      <SearchResultsList
        accommodations={[createAccommodation(7)]}
        errorMessage="검색 결과를 불러오지 못했습니다."
        getAccommodationHref={(id) => `/accommodations/${id}`}
        isErrorRetryable
        isLoading={false}
        isRefreshing
        onAccommodationClick={vi.fn()}
        onRetry={onRetry}
      />,
    );

    expect(
      screen.getByRole("button", { name: "다시 불러오는 중..." }),
    ).toBeDisabled();
  });

  it("mirrors keyboard focus into the map hover command", async () => {
    const onHoveredAccommodationChange = vi.fn();

    render(
      <SearchResultsList
        accommodations={[createAccommodation(7)]}
        getAccommodationHref={(id) => `/accommodations/${id}`}
        isLoading={false}
        onAccommodationClick={vi.fn()}
        onHoveredAccommodationChange={onHoveredAccommodationChange}
      />,
    );

    const cardAction = screen.getByRole("button", { name: "숙소 카드 7" });
    cardAction.focus();
    expect(onHoveredAccommodationChange).toHaveBeenLastCalledWith(7);

    cardAction.blur();
    expect(onHoveredAccommodationChange).toHaveBeenLastCalledWith(null);
  });

  it("delegates card clicks with the accommodation id", async () => {
    const onAccommodationClick = vi.fn();

    render(
      <SearchResultsList
        accommodations={[createAccommodation(7)]}
        getAccommodationHref={(id) => `/accommodations/${id}`}
        isLoading={false}
        onAccommodationClick={onAccommodationClick}
        onWishlistToggle={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "숙소 카드 7" }));

    expect(onAccommodationClick).toHaveBeenCalledTimes(1);
    expect(onAccommodationClick).toHaveBeenCalledWith(7);
  });

  it("uses the app-injected accommodation detail href", () => {
    render(
      <SearchResultsList
        accommodations={[createAccommodation(7)]}
        getAccommodationHref={(id) =>
          `/accommodations/${id}?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2`
        }
        isLoading={false}
        onAccommodationClick={vi.fn()}
        onWishlistToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "숙소 카드 7" })).toHaveAttribute(
      "data-detail-url",
      "/accommodations/7?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2",
    );
  });
});
