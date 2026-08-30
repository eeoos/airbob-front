import { fireEvent, render, screen } from "@testing-library/react";
import AccommodationHero from "./AccommodationHero";
import type { AccommodationDetail } from "../model/accommodationDetail";
import { toAccommodationDetailViewModel } from "../lib/accommodationDetailViewModel";

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
  images: [
    { id: 1, imageUrl: "/images/hero-1.jpg" },
    { id: 2, imageUrl: "/images/hero-2.jpg" },
    { id: 3, imageUrl: "/images/hero-3.jpg" },
    { id: 4, imageUrl: "/images/hero-4.jpg" },
    { id: 5, imageUrl: "/images/hero-5.jpg" },
    { id: 6, imageUrl: "/images/hero-6.jpg" },
  ],
  reviewSummary: {
    totalCount: 12,
    averageRating: 4.8,
  },
};

const renderHero = (
  overrides: Partial<React.ComponentProps<typeof AccommodationHero>> = {}
) => {
  const props: React.ComponentProps<typeof AccommodationHero> = {
    detailView: toAccommodationDetailViewModel(
      accommodation,
      resolveImageUrl,
    ),
    mobileSlideIndex: 0,
    onMobileSlideIndexChange: jest.fn(),
    onOpenGallery: jest.fn(),
    onSave: jest.fn(),
    onShare: jest.fn(),
    ...overrides,
  };

  render(<AccommodationHero {...props} />);

  return props;
};

describe("AccommodationHero", () => {
  it("renders title, review metadata, images, and save state", () => {
    renderHero();

    expect(
      screen.getByRole("heading", { name: "남산 전망 숙소" })
    ).toBeInTheDocument();
    expect(screen.getByText("4.8")).toBeInTheDocument();
    expect(screen.getByText("(12)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /저장/ })).toBeInTheDocument();
    expect(screen.getByAltText("남산 전망 숙소")).toHaveAttribute(
      "src",
      "/images/hero-1.jpg"
    );
    expect(screen.getAllByAltText("남산 전망 숙소 2")[0]).toHaveAttribute(
      "src",
      "/images/hero-2.jpg"
    );
  });

  it("runs the save and share actions", () => {
    const onSave = jest.fn();
    const onShare = jest.fn();
    renderHero({ onSave, onShare });

    fireEvent.click(screen.getByRole("button", { name: /저장/ }));
    fireEvent.click(screen.getByRole("button", { name: /공유하기/ }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it("opens the gallery from named desktop thumbnail buttons", () => {
    const onOpenGallery = jest.fn();
    renderHero({ onOpenGallery });

    fireEvent.click(
      screen.getByRole("button", {
        name: "남산 전망 숙소 사진 3 크게 보기",
      })
    );

    expect(onOpenGallery).toHaveBeenCalledWith(2);
  });

  it("opens the full gallery from a single named overlay thumbnail button", () => {
    const onOpenGallery = jest.fn();
    renderHero({ onOpenGallery });

    const viewAllButton = screen.getByRole("button", {
      name: "남산 전망 숙소 사진 모두 보기",
    });

    expect(viewAllButton).toHaveTextContent("사진 모두 보기");
    expect(
      screen.queryByRole("button", { name: "사진 모두 보기" })
    ).not.toBeInTheDocument();

    fireEvent.click(viewAllButton);

    expect(onOpenGallery).toHaveBeenCalledTimes(1);
    expect(onOpenGallery).toHaveBeenCalledWith(0);
  });

  it("opens the gallery from semantic main and mobile image triggers", () => {
    const onOpenGallery = jest.fn();
    renderHero({ mobileSlideIndex: 2, onOpenGallery });

    fireEvent.click(
      screen.getByRole("button", {
        name: "남산 전망 숙소 대표 사진 크게 보기",
      })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "남산 전망 숙소 모바일 사진 3 크게 보기",
      })
    );

    expect(onOpenGallery).toHaveBeenNthCalledWith(1, 0);
    expect(onOpenGallery).toHaveBeenNthCalledWith(2, 2);
  });

  it("changes mobile pagination without opening the gallery", () => {
    const onMobileSlideIndexChange = jest.fn();
    const onOpenGallery = jest.fn();
    renderHero({
      detailView: toAccommodationDetailViewModel(
        {
          ...accommodation,
          images: accommodation.images.slice(0, 5),
        },
        resolveImageUrl,
      ),
      onMobileSlideIndexChange,
      onOpenGallery,
    });

    fireEvent.click(
      screen.getByRole("button", { name: "남산 전망 숙소 사진 3 보기" })
    );

    expect(onMobileSlideIndexChange).toHaveBeenCalledWith(2);
    expect(onOpenGallery).not.toHaveBeenCalled();
  });

  it("keeps every gallery action on a stable accessible button name", () => {
    renderHero();

    [
      "남산 전망 숙소 대표 사진 크게 보기",
      "남산 전망 숙소 사진 2 크게 보기",
      "남산 전망 숙소 사진 3 크게 보기",
      "남산 전망 숙소 사진 4 크게 보기",
      "남산 전망 숙소 사진 모두 보기",
      "남산 전망 숙소 모바일 사진 1 크게 보기",
    ].forEach((name) => {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    });
  });
});
