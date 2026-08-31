import { render, screen } from "@testing-library/react";
import type { AccommodationDetail } from "../model/accommodationDetail";
import { toAccommodationDetailViewModel } from "../lib/accommodationDetailViewModel";
import { AccommodationLocationSection } from "./AccommodationLocationSection";

const resolveImageUrl = (url: string | null) => url ?? "";

const accommodation: AccommodationDetail = {
  id: 1,
  name: "남산 전망 숙소",
  description: "서울 중심의 숙소",
  type: "APARTMENT",
  basePrice: 120000,
  currency: "KRW",
  checkInTime: "15:00:00",
  checkOutTime: "11:00:00",
  unavailableDates: [],
  isInWishlist: false,
  addressSummary: {
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
    thumbnailImageUrl: null,
  },
  policy: {
    maxOccupancy: 4,
    infantOccupancy: 1,
    petOccupancy: 0,
  },
  amenities: [],
  images: [],
  reviewSummary: {
    totalCount: 0,
    averageRating: 0,
  },
};

describe("AccommodationLocationSection", () => {
  it("renders the address and embedded Google map when an API key is present", () => {
    render(
      <AccommodationLocationSection
        detailView={toAccommodationDetailViewModel(
          accommodation,
          resolveImageUrl,
        )}
        googleMapsApiKey="maps-key"
      />,
    );

    expect(screen.getByRole("heading", { name: "위치" })).toBeInTheDocument();
    expect(screen.getByText("서울, 대한민국")).toBeInTheDocument();
    const map = screen.getByTitle("숙소 위치 지도");
    const mapUrl = new URL(map.getAttribute("src")!);

    expect(map).toHaveAttribute(
      "referrerpolicy",
      "strict-origin-when-cross-origin",
    );
    expect(mapUrl.searchParams.get("key")).toBe("maps-key");
    expect(mapUrl.searchParams.get("q")).toBe("37.5512,126.9882");
    expect(mapUrl.searchParams.get("zoom")).toBe("15");
  });

  it("renders a coordinate placeholder when the API key is absent", () => {
    render(
      <AccommodationLocationSection
        detailView={toAccommodationDetailViewModel(
          accommodation,
          resolveImageUrl,
        )}
        googleMapsApiKey=""
      />,
    );

    expect(
      screen.getByText("지도 (위도: 37.5512, 경도: 126.9882)"),
    ).toBeInTheDocument();
  });
});
