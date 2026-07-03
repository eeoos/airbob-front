import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccommodationSearchInfo } from "../../../types/accommodation";
import { SearchResultsList } from "./SearchResultsList";

jest.mock("../../../components/AccommodationCard", () => ({
  AccommodationCardSearch: ({
    accommodation,
    detailUrl,
    onClick,
  }: {
    accommodation: AccommodationSearchInfo;
    detailUrl?: string;
    onClick: () => void;
  }) => (
    <button type="button" data-detail-url={detailUrl} onClick={onClick}>
      {`숙소 카드 ${accommodation.id}`}
    </button>
  ),
}));

const createAccommodation = (id: number): AccommodationSearchInfo => ({
  id,
  name: `숙소 ${id}`,
  accommodation_thumbnail_url: null,
  base_price: 100000,
  currency: "KRW",
  type: "APARTMENT",
  address_summary: {
    country: "KR",
    state: null,
    city: "Seoul",
    district: null,
  },
  coordinate: {
    latitude: 37.5,
    longitude: 127,
  },
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
  is_in_wishlist: false,
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

  it("passes the current search query to accommodation detail cards", () => {
    render(
      <SearchResultsList
        accommodations={[createAccommodation(7)]}
        isLoading={false}
        selectedAccommodationId={null}
        onAccommodationClick={jest.fn()}
        onWishlistToggle={jest.fn()}
        detailSearchParams={
          new URLSearchParams("checkIn=2026-07-10&checkOut=2026-07-12")
        }
      />
    );

    expect(screen.getByRole("button", { name: "숙소 카드 7" })).toHaveAttribute(
      "data-detail-url",
      "/accommodations/7?checkIn=2026-07-10&checkOut=2026-07-12"
    );
  });
});
