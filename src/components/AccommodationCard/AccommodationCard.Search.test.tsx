import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccommodationSearchInfo } from "../../types/accommodation";
import { AccommodationCardSearch } from "./AccommodationCard.Search";

const accommodation: AccommodationSearchInfo = {
  id: 1,
  name: "성수 숙소",
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
};

describe("AccommodationCardSearch", () => {
  it("opens the card action from keyboard Enter", async () => {
    const onClick = jest.fn();

    render(
      <AccommodationCardSearch
        accommodation={accommodation}
        onClick={onClick}
      />
    );

    const cardLink = screen.getByRole("link", {
      name: "숙소 상세 보기: 성수 숙소",
    });

    cardLink.focus();
    await userEvent.keyboard("{Enter}");

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("labels wishlist toggle state without triggering the card action", async () => {
    const onClick = jest.fn();
    const onWishlistToggle = jest.fn();

    render(
      <AccommodationCardSearch
        accommodation={accommodation}
        onClick={onClick}
        onWishlistToggle={onWishlistToggle}
      />
    );

    const wishlistButton = screen.getByRole("button", {
      name: "위시리스트에 저장",
    });

    expect(wishlistButton).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(wishlistButton);

    expect(onWishlistToggle).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("uses a query-preserving detail URL when provided", () => {
    render(
      <AccommodationCardSearch
        accommodation={accommodation}
        detailUrl="/accommodations/1?checkIn=2026-07-10&checkOut=2026-07-12"
      />
    );

    expect(
      screen.getByRole("link", { name: "숙소 상세 보기: 성수 숙소" })
    ).toHaveAttribute(
      "href",
      "/accommodations/1?checkIn=2026-07-10&checkOut=2026-07-12"
    );
  });
});
