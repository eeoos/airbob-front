import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { PaymentStatus, ReservationStatus } from "../../types/enums";
import type { GuestReservationDetail } from "../../types/reservation";
import { ReservationDetailRoute } from "./ReservationDetailRoute";

const mockNavigate = jest.fn();
const mockClearError = jest.fn();
let mockReservation: GuestReservationDetail | null = null;
let mockIsLoading = false;
let mockIsError = false;
let mockError: string | null = null;

jest.mock("./hooks", () => ({
  useReservationDetail: () => ({
    clearError: mockClearError,
    error: mockError,
    isError: mockIsError,
    isLoading: mockIsLoading,
    reservation: mockReservation,
  }),
}));

jest.mock("../../components/ErrorToast", () => ({
  ErrorToast: ({
    message,
    onClose,
  }: {
    message: string;
    onClose: () => void;
  }) => (
    <div role="alert">
      <span>{message}</span>
      <button onClick={onClose}>닫기</button>
    </div>
  ),
}));

const reservationFixture = (
  overrides: Partial<GuestReservationDetail> = {},
): GuestReservationDetail => ({
  reservation_uid: "reservation-123",
  reservation_code: "CODE-123",
  status: ReservationStatus.CONFIRMED,
  created_at: "2026-07-01T00:00:00",
  guest_count: 2,
  check_in_date_time: "2020-07-10T15:00:00",
  check_out_date_time: "2020-07-12T11:00:00",
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
  ...overrides,
});

describe("ReservationDetailRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockClearError.mockReset();
    mockReservation = reservationFixture();
    mockIsLoading = false;
    mockIsError = false;
    mockError = null;
  });

  it("shows and closes feedback passed through route state", () => {
    render(
      <ReservationDetailRoute
        locationState={{
          toastMessage: "리뷰는 작성되었지만 이미지 업로드에 실패했습니다.",
        }}
        navigate={mockNavigate}
        reservationUid="reservation-123"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "리뷰는 작성되었지만 이미지 업로드에 실패했습니다.",
    );

    fireEvent.click(screen.getByText("닫기"));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("redirects missing reservation uid to profile without replacing history", () => {
    render(
      <ReservationDetailRoute
        locationState={null}
        navigate={mockNavigate}
        reservationUid={undefined}
      />,
    );

    expect(mockNavigate).toHaveBeenCalledWith("/profile");
  });

  it("preserves loading output while fetching reservation detail", () => {
    mockIsLoading = true;

    render(
      <ReservationDetailRoute
        locationState={null}
        navigate={mockNavigate}
        reservationUid="reservation-123"
      />,
    );

    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });

  it("renders a load failure branch with toast when the detail query fails", () => {
    mockReservation = null;
    mockIsError = true;
    mockError = "해당 예약에 대한 접근 권한이 없습니다.";

    render(
      <ReservationDetailRoute
        locationState={null}
        navigate={mockNavigate}
        reservationUid="reservation-123"
      />,
    );

    expect(
      screen.getByText("예약 정보를 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByText("예약을 찾을 수 없습니다.")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "해당 예약에 대한 접근 권한이 없습니다.",
    );
  });

  it("renders the missing reservation branch when there is no query error", () => {
    mockReservation = null;

    render(
      <ReservationDetailRoute
        locationState={null}
        navigate={mockNavigate}
        reservationUid="reservation-123"
      />,
    );

    expect(screen.getByText("예약을 찾을 수 없습니다.")).toBeInTheDocument();
  });

  it.each([
    [ReservationStatus.PAYMENT_COMPLETED, "결제 완료"],
    [ReservationStatus.COMPLETED, "이용 완료"],
  ])("renders the shared label for %s", (status, label) => {
    mockReservation = reservationFixture({ status });

    render(
      <ReservationDetailRoute
        locationState={null}
        navigate={mockNavigate}
        reservationUid="reservation-123"
      />,
    );

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("shows review creation only for confirmed completed stays with review permission", () => {
    mockReservation = reservationFixture({
      can_write_review: true,
      status: ReservationStatus.CONFIRMED,
    });

    const { rerender } = render(
      <ReservationDetailRoute
        locationState={null}
        navigate={mockNavigate}
        reservationUid="reservation-123"
      />,
    );

    expect(screen.getByText("리뷰 작성하기")).toBeInTheDocument();

    fireEvent.click(screen.getByText("리뷰 작성하기"));

    expect(mockNavigate).toHaveBeenCalledWith("/reservations/reservation-123/review");

    mockReservation = reservationFixture({
      can_write_review: true,
      status: ReservationStatus.COMPLETED,
    });

    rerender(
      <ReservationDetailRoute
        locationState={null}
        navigate={mockNavigate}
        reservationUid="reservation-123"
      />,
    );

    expect(screen.queryByText("리뷰 작성하기")).not.toBeInTheDocument();
  });

  it("renders virtual account payment details with numeric bank names", () => {
    mockReservation = reservationFixture({
      payment: {
        order_id: "order-123",
        method: "가상계좌",
        total_amount: 120000,
        status: PaymentStatus.WAITING_FOR_DEPOSIT,
        requested_at: "2026-07-01T00:00:00",
        approved_at: null,
        virtual_account: {
          account_number: "123-456",
          bank_code: "04",
          customer_name: "홍길동",
          due_date: "2026-07-02T23:59:00",
        },
      },
    });

    render(
      <ReservationDetailRoute
        locationState={null}
        navigate={mockNavigate}
        reservationUid="reservation-123"
      />,
    );

    expect(screen.getByText("입금 대기")).toBeInTheDocument();
    expect(screen.getByText("₩120,000")).toBeInTheDocument();
    expect(screen.getByText("KB국민은행")).toBeInTheDocument();
    expect(screen.getByText("123-456")).toBeInTheDocument();
  });
});
