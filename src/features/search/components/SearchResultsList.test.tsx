import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchAccommodationCardViewModel } from "../lib/searchAccommodationViewModel";
import { SearchResultsList } from "./SearchResultsList";

jest.mock("./SearchAccommodationCard", () => ({
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
        isLoading={true}
        selectedAccommodationId={null}
        onAccommodationClick={jest.fn()}
        onWishlistToggle={jest.fn()}
      />
    );

    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });

  it("delegates card clicks with the accommodation id", async () => {
    const onAccommodationClick = jest.fn();

    render(
      <SearchResultsList
        accommodations={[createAccommodation(7)]}
        isLoading={false}
        selectedAccommodationId={null}
        onAccommodationClick={onAccommodationClick}
        onWishlistToggle={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "숙소 카드 7" }));

    expect(onAccommodationClick).toHaveBeenCalledTimes(1);
    expect(onAccommodationClick).toHaveBeenCalledWith(7);
  });

  it("passes only booking-safe search query to accommodation detail cards", () => {
    render(
      <SearchResultsList
        accommodations={[createAccommodation(7)]}
        isLoading={false}
        selectedAccommodationId={null}
        onAccommodationClick={jest.fn()}
        onWishlistToggle={jest.fn()}
        detailSearchParams={
          new URLSearchParams(
            "destination=Seoul&checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2&token=secret&email=a@example.com"
          )
        }
      />
    );

    expect(screen.getByRole("button", { name: "숙소 카드 7" })).toHaveAttribute(
      "data-detail-url",
      "/accommodations/7?checkIn=2026-07-10&checkOut=2026-07-12&adultOccupancy=2"
    );
  });
});
