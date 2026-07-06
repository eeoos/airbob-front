import React from "react";
import { render } from "@testing-library/react";
import Wishlist from "./Wishlist";

const mockSetSearchParams = jest.fn();
let mockSearchParams = new URLSearchParams("");

interface MockWishlistRouteProps {
  className?: string;
  searchParams: URLSearchParams;
  setSearchParams: typeof mockSetSearchParams;
  toastClassName?: string;
}

const mockWishlistRoute = jest.fn(
  (_props: MockWishlistRouteProps) => <div data-testid="wishlist-route" />,
);

jest.mock(
  "react-router-dom",
  () => ({
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  }),
  { virtual: true },
);

jest.mock("../../features/wishlist", () => ({
  WishlistRoute: (props: MockWishlistRouteProps) => mockWishlistRoute(props),
}));

describe("Wishlist route state integration", () => {
  beforeEach(() => {
    mockSetSearchParams.mockReset();
    mockWishlistRoute.mockClear();
    mockSearchParams = new URLSearchParams("view=recently-viewed");
  });

  it("delegates search params to the wishlist feature route", () => {
    render(<Wishlist />);

    expect(mockWishlistRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        searchParams: mockSearchParams,
        setSearchParams: mockSetSearchParams,
      }),
    );
  });
});
