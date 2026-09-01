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
        selectedAccommodationId={null}
        onAccommodationClick={vi.fn()}
        onWishlistToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("로딩 중...");
    expect(screen.getByRole("status")).toHaveAttribute(
      "data-state-kind",
      "loading",
    );
  });

  it("delegates card clicks with the accommodation id", async () => {
    const onAccommodationClick = vi.fn();

    render(
      <SearchResultsList
        accommodations={[createAccommodation(7)]}
        getAccommodationHref={(id) => `/accommodations/${id}`}
        isLoading={false}
        selectedAccommodationId={null}
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
        selectedAccommodationId={null}
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
