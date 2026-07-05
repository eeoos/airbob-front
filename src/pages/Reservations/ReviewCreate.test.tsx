import React from "react";
import { render } from "@testing-library/react";
import ReviewCreate from "./ReviewCreate";

const mockNavigate = jest.fn();
const mockReviewCreateRoute = jest.fn((_props: unknown) => null);
let mockReservationUid: string | undefined = "reservation-123";

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ reservationUid: mockReservationUid }),
}), { virtual: true });

jest.mock("../../features/reviews", () => ({
  ReviewCreateRoute: (props: unknown) => mockReviewCreateRoute(props),
}));

describe("ReviewCreate", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockReviewCreateRoute.mockClear();
    mockReservationUid = "reservation-123";
  });

  it("passes router primitives to the review create feature route", () => {
    mockReservationUid = undefined;

    render(<ReviewCreate />);

    expect(mockReviewCreateRoute).toHaveBeenCalledWith({
      navigate: mockNavigate,
      reservationUid: undefined,
    });
  });
});
