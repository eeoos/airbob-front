import React from "react";
import { render, screen } from "@testing-library/react";
import ReservationDetail from "./ReservationDetail";

const mockNavigate = jest.fn();
const mockClearError = jest.fn();

jest.mock("react-router-dom", () => ({
  useLocation: () => ({
    state: {
      toastMessage: "리뷰는 작성되었지만 이미지 업로드에 실패했습니다.",
    },
  }),
  useNavigate: () => mockNavigate,
  useParams: () => ({ reservationUid: "reservation-123" }),
}), { virtual: true });

jest.mock("../../features/reservations", () => ({
  useReservationDetail: () => ({
    clearError: mockClearError,
    error: null,
    isLoading: false,
    reservation: {
      reservation_uid: "reservation-123",
      reservation_code: "CODE-123",
      status: "CONFIRMED",
      created_at: "2026-07-01T00:00:00",
      guest_count: 2,
      check_in_date_time: "2026-07-10T15:00:00",
      check_out_date_time: "2026-07-12T11:00:00",
      check_in_time: "15:00",
      check_out_time: "11:00",
      can_write_review: false,
      accommodation: {
        id: 7,
        name: "테스트 숙소",
        thumbnail_url: null,
      },
      address: {
        country: "KR",
        state: null,
        city: "Seoul",
        district: "Mapo",
        street: "와우산로",
        detail: null,
        postal_code: "04000",
      },
      coordinate: {
        latitude: null,
        longitude: null,
      },
      host: {
        id: 1,
        nickname: "호스트",
        thumbnail_image_url: null,
      },
      payment: null,
    },
  }),
}));

jest.mock("../../components/ErrorToast", () => ({
  ErrorToast: ({ message }: { message: string }) => (
    <div role="alert">{message}</div>
  ),
}));

describe("ReservationDetail", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockClearError.mockReset();
  });

  it("shows feedback passed through route state", () => {
    render(<ReservationDetail />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "리뷰는 작성되었지만 이미지 업로드에 실패했습니다."
    );
  });
});
