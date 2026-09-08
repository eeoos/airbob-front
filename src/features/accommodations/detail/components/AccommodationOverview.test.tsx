import { fireEvent, render, screen, within } from "@testing-library/react";
import { accommodationAmenityCatalog } from "../../public";
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
  timeZoneId: "Asia/Seoul",
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
  overrides: Partial<React.ComponentProps<typeof AccommodationOverview>> = {},
) => {
  const props: React.ComponentProps<typeof AccommodationOverview> = {
    detailView: toAccommodationDetailViewModel(
      accommodation,
      resolveImageUrl,
      accommodationAmenityCatalog,
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

    const amenities = screen.getByRole("region", {
      name: "숙소 편의시설",
    });
    expect(
      within(amenities).getByRole("heading", {
        level: 2,
        name: "숙소 편의시설",
      }),
    ).toBeVisible();
    expect(within(amenities).queryAllByRole("img")).toHaveLength(0);
  });

  it("keeps host, description, and amenities in a clear reading order", () => {
    renderOverview();

    const host = screen.getByRole("region", { name: "호스트 정보" });
    const description = screen.getByRole("region", { name: "숙소 설명" });
    const amenities = screen.getByRole("region", {
      name: "숙소 편의시설",
    });

    expect(host).toAppearBefore(description);
    expect(description).toAppearBefore(amenities);
  });

  it("does not render an empty description section", () => {
    renderOverview({
      detailView: toAccommodationDetailViewModel(
        {
          ...accommodation,
          description: "",
        },
        resolveImageUrl,
        accommodationAmenityCatalog,
      ),
    });

    expect(
      screen.queryByRole("region", { name: "숙소 설명" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "숙소 편의시설" }),
    ).toBeInTheDocument();
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
        accommodationAmenityCatalog,
      ),
    });

    expect(screen.getByText("호")).toBeInTheDocument();
  });

  it("uses the host initial when the thumbnail fails to load", () => {
    renderOverview();

    fireEvent.error(screen.getByAltText("호스트"));

    expect(
      screen.getByRole("img", { name: "호스트 프로필 이미지 없음" }),
    ).toHaveTextContent("호");
  });

  it("renders an explicit catalog signal for an unknown amenity", () => {
    const { container } = render(
      <AccommodationOverview
        detailView={toAccommodationDetailViewModel(
          {
            ...accommodation,
            amenities: [{ type: "FUTURE_AMENITY", count: 1 }],
          },
          resolveImageUrl,
          accommodationAmenityCatalog,
        )}
        onOpenDescription={vi.fn()}
      />,
    );

    expect(screen.getByText("알 수 없는 편의시설")).toBeInTheDocument();
    // The data contract is intentionally machine-readable for monitoring/tests.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const unknownAmenity = container.querySelector(
      '[data-amenity-known="false"]',
    );
    expect(unknownAmenity).toHaveAttribute(
      "data-amenity-code",
      "FUTURE_AMENITY",
    );
  });
});
