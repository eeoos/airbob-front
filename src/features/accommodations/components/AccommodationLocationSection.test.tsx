import { render, screen } from "@testing-library/react";
import { AccommodationDetail } from "../../../types/accommodation";
import { toAccommodationDetailViewModel } from "../lib/accommodationDetailViewModel";
import { AccommodationLocationSection } from "./AccommodationLocationSection";

const accommodation: AccommodationDetail = {
  id: 1,
  name: "남산 전망 숙소",
  description: "서울 중심의 숙소",
  type: "APARTMENT",
  base_price: 120000,
  currency: "KRW",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  unavailable_dates: [],
  is_in_wishlist: false,
  address_summary: {
    country: "대한민국",
    state: null,
    city: "서울",
    district: "중구",
  },
  coordinate: {
    latitude: 37.5512,
    longitude: 126.9882,
  },
  host: {
    id: 10,
    nickname: "호스트",
    thumbnail_image_url: null,
  },
  policy: {
    max_occupancy: 4,
    infant_occupancy: 1,
    pet_occupancy: 0,
  },
  amenities: [],
  images: [],
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
};

describe("AccommodationLocationSection", () => {
  it("renders the address and embedded Google map when an API key is present", () => {
    render(
      <AccommodationLocationSection
        detailView={toAccommodationDetailViewModel(accommodation)}
        googleMapsApiKey="maps-key"
      />
    );

    expect(screen.getByRole("heading", { name: "위치" })).toBeInTheDocument();
    expect(screen.getByText("서울, 대한민국")).toBeInTheDocument();
    expect(screen.getByTitle("숙소 위치 지도")).toHaveAttribute(
      "src",
      expect.stringContaining("key=maps-key")
    );
  });

  it("renders a coordinate placeholder when the API key is absent", () => {
    render(
      <AccommodationLocationSection
        detailView={toAccommodationDetailViewModel(accommodation)}
        googleMapsApiKey=""
      />
    );

    expect(
      screen.getByText("지도 (위도: 37.5512, 경도: 126.9882)")
    ).toBeInTheDocument();
  });
});
