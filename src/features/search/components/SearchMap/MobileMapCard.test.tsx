import { fireEvent, render, screen } from "@testing-library/react";
import { MobileMapCard } from "./MobileMapCard";
import type { SearchMapAccommodation } from "./types";

const stay: SearchMapAccommodation = {
  id: 7,
  name: "부산 숙소",
  locationLabel: "부산, 동구",
  thumbnailUrl: null,
  coordinate: { latitude: 35.1, longitude: 129.1 },
  basePrice: 100000,
  currency: "KRW",
  isInWishlist: false,
  showReview: true,
  reviewRatingLabel: "4.8",
  reviewCountLabel: "(12)",
};
const props = () => ({
  accommodation: stay,
  getAccommodationHref: (id: number) => `/accommodations/${id}`,
  onAccommodationOpen: vi.fn(),
  onWishlistToggle: vi.fn(),
  onClose: vi.fn(),
});

describe("MobileMapCard", () => {
  it("updates the same bottom card when another marker is selected and uses the searched stay price", () => {
    const input = props();
    const { rerender } = render(
      <MobileMapCard {...input} checkIn="2026-10-11" checkOut="2026-10-16" />,
    );
    const card = screen.getByRole("region", { name: "선택한 숙소" });
    expect(screen.getByText("₩500,000")).toBeInTheDocument();
    expect(screen.getByText("5박")).toBeInTheDocument();
    expect(screen.getByText("10월 11일 ~ 10월 16일")).toBeInTheDocument();
    rerender(
      <MobileMapCard
        {...input}
        accommodation={{ ...stay, id: 8, name: "두 번째 숙소" }}
      />,
    );
    expect(screen.getByRole("region", { name: "선택한 숙소" })).toBe(card);
    fireEvent.click(
      screen.getByRole("link", { name: "숙소 상세 보기: 두 번째 숙소" }),
    );
    expect(input.onAccommodationOpen).toHaveBeenCalledWith(8);
    expect(screen.getByText("₩100,000")).toBeInTheDocument();
    expect(screen.getByText("1박")).toBeInTheDocument();
  });

  it("keeps wishlist and dismissal actions separate from accommodation navigation", () => {
    const input = props();
    render(<MobileMapCard {...input} />);
    fireEvent.click(screen.getByRole("button", { name: "위시리스트에 저장" }));
    expect(input.onWishlistToggle).toHaveBeenCalledWith(7);
    expect(input.onClose).toHaveBeenCalledTimes(1);
    expect(input.onAccommodationOpen).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "지도 숙소 카드 닫기" }),
    );
    expect(input.onClose).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(screen.getByRole("region", { name: "선택한 숙소" }), {
      key: "Escape",
    });
    expect(input.onClose).toHaveBeenCalledTimes(3);
  });

  it("removes the card when selection clears", () => {
    const input = props();
    const { rerender } = render(<MobileMapCard {...input} />);
    rerender(<MobileMapCard {...input} accommodation={null} />);
    expect(
      screen.queryByRole("region", { name: "선택한 숙소" }),
    ).not.toBeInTheDocument();
  });
});
