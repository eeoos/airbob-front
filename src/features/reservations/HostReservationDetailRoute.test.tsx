import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { NavigateFunction } from "react-router-dom";
import { PaymentStatus, ReservationStatus } from "../../types/enums";
import type { HostReservationDetail } from "../../types/reservation";
import { HostReservationDetailRoute } from "./HostReservationDetailRoute";
import { useHostReservationDetail } from "./hooks";

const mockClearError = jest.fn();
const mockNavigate = jest.fn() as jest.MockedFunction<NavigateFunction>;

jest.mock("./hooks", () => ({
  useHostReservationDetail: jest.fn(),
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
      {message}
      <button onClick={onClose}>닫기</button>
    </div>
  ),
}));

const createHostReservationDetail = (): HostReservationDetail => ({
    reservation_uid: "host-reservation-1",
    reservation_code: "HOST-CODE-1",
    status: ReservationStatus.CONFIRMED,
    created_at: "2026-07-01T00:00:00",
    guest_count: 2,
    check_in_date_time: "2026-07-10T15:00:00",
    check_out_date_time: "2026-07-12T11:00:00",
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
    guest: {
      id: 2,
      nickname: "게스트",
      thumbnail_image_url: null,
    },
    payment: {
      order_id: "order-1",
      total_amount: 240000,
      status: PaymentStatus.DONE,
      requested_at: "2026-07-01T00:00:00",
    },
  });

const mockHostReservationDetail = (
  overrides: Partial<ReturnType<typeof useHostReservationDetail>>,
) => {
  jest.mocked(useHostReservationDetail).mockReturnValue({
    error: null,
    clearError: mockClearError,
    isLoading: false,
    reload: jest.fn(),
    reservation: createHostReservationDetail(),
    ...overrides,
  });
};

beforeEach(() => {
  mockClearError.mockReset();
  mockNavigate.mockReset();
  jest.mocked(useHostReservationDetail).mockReset();
});

describe("HostReservationDetailRoute", () => {
  it("renders the existing loading branch while fetching reservation detail", () => {
    mockHostReservationDetail({
      isLoading: true,
      reservation: null,
    });

    render(
      <HostReservationDetailRoute
        navigate={mockNavigate}
        reservationUid="host-reservation-1"
      />,
    );

    expect(screen.getByText("로딩 중...")).toBeInTheDocument();
  });

  it("renders the existing empty branch when reservation detail is missing", () => {
    mockHostReservationDetail({
      reservation: null,
    });

    render(
      <HostReservationDetailRoute
        navigate={mockNavigate}
        reservationUid="host-reservation-1"
      />,
    );

    expect(screen.getByText("예약을 찾을 수 없습니다.")).toBeInTheDocument();
  });

  it("redirects to profile when reservation uid is missing", () => {
    mockHostReservationDetail({
      reservation: null,
    });

    render(
      <HostReservationDetailRoute
        navigate={mockNavigate}
        reservationUid={undefined}
      />,
    );

    expect(mockNavigate).toHaveBeenCalledWith("/profile", { replace: true });
  });

  it("renders reservation detail using shared display helpers", () => {
    mockHostReservationDetail({});

    render(
      <HostReservationDetailRoute
        navigate={mockNavigate}
        reservationUid="host-reservation-1"
      />,
    );

    expect(screen.getByText("확정됨")).toBeInTheDocument();
    expect(screen.getAllByText("게스트")).toHaveLength(2);
    expect(screen.getByText("2게스트 • 2박 • ₩240,000")).toBeInTheDocument();
    expect(screen.getByText("테스트 숙소")).toBeInTheDocument();
    expect(screen.getByText("KR Seoul Mapo 와우산로")).toBeInTheDocument();
    expect(screen.getByText("2026년 7월 10일 (금)")).toBeInTheDocument();
    expect(screen.getByText("2026년 7월 12일 (일)")).toBeInTheDocument();
    expect(screen.getByText("2026년 7월 1일 (수)")).toBeInTheDocument();
    expect(screen.getByText("2박 x ₩120,000")).toBeInTheDocument();
    expect(screen.getAllByText("₩240,000")).toHaveLength(2);

    fireEvent.click(screen.getByText("테스트 숙소"));
    expect(mockNavigate).toHaveBeenCalledWith("/accommodations/7");
  });

  it("keeps back navigation and error toast behavior", () => {
    mockHostReservationDetail({
      error: "예약 상세 조회에 실패했습니다.",
    });

    render(
      <HostReservationDetailRoute
        navigate={mockNavigate}
        reservationUid="host-reservation-1"
      />,
    );

    fireEvent.click(screen.getByText("←"));
    expect(mockNavigate).toHaveBeenCalledWith(-1);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "예약 상세 조회에 실패했습니다.",
    );
    fireEvent.click(screen.getByText("닫기"));
    expect(mockClearError).toHaveBeenCalledTimes(1);
  });
});
