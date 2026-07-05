import { fireEvent, render, screen } from "@testing-library/react";
import AccommodationHero from "./AccommodationHero";
import { AccommodationDetail } from "../../../types/accommodation";

jest.mock("../../../utils/image", () => ({
  getImageUrl: (url: string) => url,
}));

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
  images: [
    { id: 1, image_url: "/images/hero-1.jpg" },
    { id: 2, image_url: "/images/hero-2.jpg" },
    { id: 3, image_url: "/images/hero-3.jpg" },
    { id: 4, image_url: "/images/hero-4.jpg" },
    { id: 5, image_url: "/images/hero-5.jpg" },
    { id: 6, image_url: "/images/hero-6.jpg" },
  ],
  review_summary: {
    total_count: 12,
    average_rating: 4.8,
  },
};

const renderHero = (
  overrides: Partial<React.ComponentProps<typeof AccommodationHero>> = {}
) => {
  const props: React.ComponentProps<typeof AccommodationHero> = {
    accommodation,
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

  it("opens the gallery from a desktop thumbnail", () => {
    const onOpenGallery = jest.fn();
    renderHero({ onOpenGallery });

    fireEvent.click(screen.getAllByAltText("남산 전망 숙소 3")[0]);

    expect(onOpenGallery).toHaveBeenCalledWith(2);
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
        name: "남산 전망 숙소 사진 3 크게 보기",
      })
    );

    expect(onOpenGallery).toHaveBeenNthCalledWith(1, 0);
    expect(onOpenGallery).toHaveBeenNthCalledWith(2, 2);
  });

  it("changes mobile pagination without opening the gallery", () => {
    const onMobileSlideIndexChange = jest.fn();
    const onOpenGallery = jest.fn();
    renderHero({
      accommodation: {
        ...accommodation,
        images: accommodation.images.slice(0, 5),
      },
      onMobileSlideIndexChange,
      onOpenGallery,
    });

    fireEvent.click(
      screen.getByRole("button", { name: "남산 전망 숙소 사진 3 보기" })
    );

    expect(onMobileSlideIndexChange).toHaveBeenCalledWith(2);
    expect(onOpenGallery).not.toHaveBeenCalled();
  });
});
