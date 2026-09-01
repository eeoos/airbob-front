import { fireEvent, render, screen } from "@testing-library/react";
import { accommodationAmenityCatalog } from "../../public";
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
  overrides: Partial<React.ComponentProps<typeof AccommodationHero>> = {},
) => {
  const props: React.ComponentProps<typeof AccommodationHero> = {
    detailView: toAccommodationDetailViewModel(
      accommodation,
      resolveImageUrl,
      accommodationAmenityCatalog,
    ),
    mobileSlideIndex: 0,
    onMobileSlideIndexChange: vi.fn(),
    onOpenGallery: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };

  render(<AccommodationHero {...props} />);

  return props;
};

describe("AccommodationHero", () => {
  it("renders title, review metadata, images, and save state", () => {
    renderHero();

    expect(
      screen.getByRole("heading", { name: "남산 전망 숙소" }),
    ).toBeInTheDocument();
    expect(screen.getByText("4.8")).toBeInTheDocument();
    expect(screen.getByText("(12)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /저장/ })).toBeInTheDocument();
    expect(screen.getByAltText("남산 전망 숙소")).toHaveAttribute(
      "src",
      "/images/hero-1.jpg",
    );
    expect(screen.getAllByAltText("남산 전망 숙소 2")[0]).toHaveAttribute(
      "src",
      "/images/hero-2.jpg",
    );
  });

  it("runs the save action without exposing the unfinished share control", () => {
    const onSave = vi.fn();
    renderHero({ onSave });

    fireEvent.click(screen.getByRole("button", { name: /저장/ }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("button", { name: /공유하기/ }),
    ).not.toBeInTheDocument();
  });

  it("opens the gallery from named desktop thumbnail buttons", () => {
    const onOpenGallery = vi.fn();
    renderHero({ onOpenGallery });

    fireEvent.click(
      screen.getByRole("button", {
        name: "남산 전망 숙소 사진 3 크게 보기",
      }),
    );

    expect(onOpenGallery).toHaveBeenCalledWith(2);
  });

  it("opens the full gallery from a single named overlay thumbnail button", () => {
    const onOpenGallery = vi.fn();
    renderHero({ onOpenGallery });

    const viewAllButton = screen.getByRole("button", {
      name: "남산 전망 숙소 사진 모두 보기",
    });

    expect(viewAllButton).toHaveTextContent("사진 모두 보기");
    expect(
      screen.queryByRole("button", { name: "사진 모두 보기" }),
    ).not.toBeInTheDocument();

    fireEvent.click(viewAllButton);

    expect(onOpenGallery).toHaveBeenCalledTimes(1);
    expect(onOpenGallery).toHaveBeenCalledWith(0);
  });

  it("opens the gallery from semantic main and mobile image triggers", () => {
    const onOpenGallery = vi.fn();
    renderHero({ mobileSlideIndex: 2, onOpenGallery });

    fireEvent.click(
      screen.getByRole("button", {
        name: "남산 전망 숙소 대표 사진 크게 보기",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "남산 전망 숙소 모바일 사진 3 크게 보기",
      }),
    );

    expect(onOpenGallery).toHaveBeenNthCalledWith(1, 0);
    expect(onOpenGallery).toHaveBeenNthCalledWith(2, 2);
  });

  it("changes mobile pagination without opening the gallery", () => {
    const onMobileSlideIndexChange = vi.fn();
    const onOpenGallery = vi.fn();
    renderHero({
      detailView: toAccommodationDetailViewModel(
        {
          ...accommodation,
          images: accommodation.images.slice(0, 5),
        },
        resolveImageUrl,
        accommodationAmenityCatalog,
      ),
      onMobileSlideIndexChange,
      onOpenGallery,
    });

    fireEvent.click(
      screen.getByRole("button", { name: "남산 전망 숙소 사진 3 보기" }),
    );

    expect(onMobileSlideIndexChange).toHaveBeenCalledWith(2);
    expect(onOpenGallery).not.toHaveBeenCalled();
  });

  it("offers keyboard alternatives for mobile image navigation", () => {
    const onMobileSlideIndexChange = vi.fn();
    renderHero({ mobileSlideIndex: 2, onMobileSlideIndexChange });

    const slider = screen.getByRole("button", {
      name: "남산 전망 숙소 모바일 사진 3 크게 보기",
    });

    expect(slider).toHaveAttribute(
      "aria-keyshortcuts",
      "ArrowLeft ArrowRight Home End",
    );

    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "Home" });
    fireEvent.keyDown(slider, { key: "End" });

    expect(onMobileSlideIndexChange).toHaveBeenNthCalledWith(1, 3);
    expect(onMobileSlideIndexChange).toHaveBeenNthCalledWith(2, 0);
    expect(onMobileSlideIndexChange).toHaveBeenNthCalledWith(3, 5);
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

  it("keeps a deterministic hero frame when the accommodation has no images", () => {
    renderHero({
      detailView: toAccommodationDetailViewModel(
        { ...accommodation, images: [] },
        resolveImageUrl,
        accommodationAmenityCatalog,
      ),
    });

    expect(
      screen.getByRole("img", { name: "남산 전망 숙소 숙소 사진 없음" }),
    ).toHaveTextContent("숙소 사진을 준비하고 있어요");
    expect(
      screen.queryByRole("button", { name: /사진.*크게 보기/ }),
    ).not.toBeInTheDocument();
  });

  it("replaces a failed hero image without removing its gallery trigger", () => {
    renderHero();

    fireEvent.error(screen.getByAltText("남산 전망 숙소"));

    expect(
      screen.getByRole("img", {
        name: "남산 전망 숙소 대표 사진을 불러올 수 없음",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "남산 전망 숙소 대표 사진 크게 보기",
      }),
    ).toBeInTheDocument();
  });
});
