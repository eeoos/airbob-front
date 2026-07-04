import React from "react";
import { render, screen } from "@testing-library/react";
import ReservationDetail from "./ReservationDetail";

const mockNavigate = jest.fn();

jest.mock(
  "react-router-dom",
  () => ({
    useLocation: () => ({
      state: {
        toastMessage: "리뷰는 작성되었지만 이미지 업로드에 실패했습니다.",
      },
    }),
    useNavigate: () => mockNavigate,
    useParams: () => ({ reservationUid: "reservation-123" }),
  }),
  { virtual: true },
);

jest.mock("../../features/reservations", () => ({
  ReservationDetailRoute: ({
    locationState,
    navigate,
    reservationUid,
  }: {
    locationState: { toastMessage?: string } | null;
    navigate: typeof mockNavigate;
    reservationUid?: string;
  }) => (
    <div>
      <span data-testid="reservation-uid">{reservationUid}</span>
      <span data-testid="toast-message">{locationState?.toastMessage}</span>
      <button onClick={() => navigate("/profile")}>navigate</button>
    </div>
  ),
}));

describe("ReservationDetail", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("passes router state, navigate, and params to the feature route", () => {
    render(<ReservationDetail />);

    expect(screen.getByTestId("reservation-uid")).toHaveTextContent(
      "reservation-123",
    );
    expect(screen.getByTestId("toast-message")).toHaveTextContent(
      "리뷰는 작성되었지만 이미지 업로드에 실패했습니다.",
    );

    screen.getByText("navigate").click();

    expect(mockNavigate).toHaveBeenCalledWith("/profile");
  });
});
