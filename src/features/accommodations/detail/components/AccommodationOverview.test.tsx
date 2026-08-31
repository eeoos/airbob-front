import { fireEvent, render, screen } from "@testing-library/react";
import type { AccommodationDetail } from "../model/accommodationDetail";
import { toAccommodationDetailViewModel } from "../lib/accommodationDetailViewModel";
import { AccommodationOverview } from "./AccommodationOverview";

const resolveImageUrl = (url: string | null) => url ?? "";

const accommodation: AccommodationDetail = {
  id: 1,
  name: "남산 전망 숙소",
  description: "서울 중심의 숙소입니다. 오래 머물기 좋은 공간입니다.",
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
    thumbnailImageUrl: "/host.jpg",
  },
  policy: {
    maxOccupancy: 4,
    infantOccupancy: 1,
    petOccupancy: 0,
  },
  amenities: [
    { type: "WIFI", count: 1 },
    { type: "AIR_CONDITIONER", count: 1 },
  ],
  images: [],
  reviewSummary: {
    totalCount: 0,
    averageRating: 0,
  },
};

const renderOverview = (
  overrides: Partial<React.ComponentProps<typeof AccommodationOverview>> = {}
) => {
  const props: React.ComponentProps<typeof AccommodationOverview> = {
    detailView: toAccommodationDetailViewModel(
      accommodation,
      resolveImageUrl,
    ),
    onOpenDescription: vi.fn(),
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
    const onOpenDescription = vi.fn();
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
      detailView: toAccommodationDetailViewModel(
        {
          ...accommodation,
          host: {
            ...accommodation.host,
            thumbnailImageUrl: null,
          },
        },
        resolveImageUrl,
      ),
    });

    expect(screen.getByText("호")).toBeInTheDocument();
  });
});
