import { fireEvent, render, screen } from "@testing-library/react";
import { AccommodationDetail } from "../../../types/accommodation";
import { toAccommodationDetailViewModel } from "../lib/accommodationDetailViewModel";
import { AccommodationOverview } from "./AccommodationOverview";

jest.mock("../../../utils/image", () => ({
  getImageUrl: (url: string) => url,
}));

const accommodation: AccommodationDetail = {
  id: 1,
  name: "남산 전망 숙소",
  description: "서울 중심의 숙소입니다. 오래 머물기 좋은 공간입니다.",
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
    thumbnail_image_url: "/host.jpg",
  },
  policy: {
    max_occupancy: 4,
    infant_occupancy: 1,
    pet_occupancy: 0,
  },
  amenities: [
    { type: "WIFI", count: 1 },
    { type: "AIR_CONDITIONER", count: 1 },
  ],
  images: [],
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
};

const renderOverview = (
  overrides: Partial<React.ComponentProps<typeof AccommodationOverview>> = {}
) => {
  const props: React.ComponentProps<typeof AccommodationOverview> = {
    detailView: toAccommodationDetailViewModel(accommodation),
    onOpenDescription: jest.fn(),
    ...overrides,
  };

  render(<AccommodationOverview {...props} />);

  return props;
};

describe("AccommodationOverview", () => {
  it("renders location, amenities, host, and description summary", () => {
    renderOverview();

    expect(screen.getByText("서울의 아파트")).toBeInTheDocument();
    expect(screen.getByText("최대 인원 4명")).toBeInTheDocument();
    expect(screen.getByText("무선 인터넷")).toBeInTheDocument();
    expect(screen.getByText("에어컨")).toBeInTheDocument();
    expect(screen.getByAltText("호스트")).toHaveAttribute("src", "/host.jpg");
    expect(screen.getByText("호스트 님")).toBeInTheDocument();
    expect(screen.getByText(accommodation.description)).toBeInTheDocument();
  });

  it("opens the full description when the summary is truncated", () => {
    const onOpenDescription = jest.fn();
    renderOverview({
      maxDescriptionLength: 5,
      onOpenDescription,
    });

    expect(screen.getByText("서울 중심...")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));

    expect(onOpenDescription).toHaveBeenCalledTimes(1);
  });

  it("uses the host initial when the host has no thumbnail", () => {
    renderOverview({
      detailView: toAccommodationDetailViewModel({
        ...accommodation,
        host: {
          ...accommodation.host,
          thumbnail_image_url: null,
        },
      }),
    });

    expect(screen.getByText("호")).toBeInTheDocument();
  });
});
