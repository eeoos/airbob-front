import React from "react";
import { render, screen } from "@testing-library/react";
import { reservationApi } from "../../api";
import { ReservationStatus } from "../../types/enums";
import { HostReservationsPanel } from "./HostReservationsPanel";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock("../../api", () => ({
  reservationApi: {
    getHostReservations: jest.fn(),
  },
}));

jest.mock("../../hooks/useApiError", () => ({
  useApiError: () => ({
    error: null,
    clearError: mockClearError,
    handleError: mockHandleError,
  }),
}));

jest.mock("../../components/ErrorToast", () => ({
  ErrorToast: ({ message }: { message: string }) => (
    <div role="alert">{message}</div>
  ),
}));

jest.mock("../../shared/ui", () => {
  const React = require("react");

  return {
    EmptyState: ({ title }: { title: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "shared-empty-state" }, title),
    LoadingState: ({ title }: { title: React.ReactNode }) =>
      React.createElement(
        "div",
        { "data-testid": "shared-loading-state", role: "status" },
        title
      ),
  };
});

const createHostReservation = (
  reservationId: number,
  status: ReservationStatus
) =>
  ({
    reservation_uid: `host-${reservationId}`,
    reservation_code: `CODE-${reservationId}`,
    total_price: 100000 + reservationId,
    currency: "KRW",
    guest_count: 2,
    check_in_date: `2026-07-${10 + reservationId}`,
    check_out_date: `2026-07-${12 + reservationId}`,
    created_at: "2026-07-01",
    status,
    guest: {
      id: reservationId,
      nickname: `게스트 ${reservationId}`,
    },
    accommodation: {
      id: reservationId,
      name: `숙소 ${reservationId}`,
    },
  } as any);

beforeEach(() => {
  mockClearError.mockReset();
  mockHandleError.mockReset();
  jest.mocked(reservationApi.getHostReservations).mockReset();
  window.IntersectionObserver = jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
    observe: jest.fn(),
    unobserve: jest.fn(),
  }));
});

describe("HostReservationsPanel", () => {
  it("renders shared loading state while fetching reservations", async () => {
    jest.mocked(reservationApi.getHostReservations).mockResolvedValue({
      page_info: {
        has_next: false,
        next_cursor: null,
      },
      reservations: [],
    } as any);

    render(
      <HostReservationsPanel filterType="UPCOMING" onFilterChange={jest.fn()} />
    );

    expect(screen.getByTestId("shared-loading-state")).toHaveTextContent(
      "로딩 중..."
    );
    await screen.findByTestId("shared-empty-state");
  });

  it("renders shared empty state when the host has no reservations", async () => {
    jest.mocked(reservationApi.getHostReservations).mockResolvedValue({
      page_info: {
        has_next: false,
        next_cursor: null,
      },
      reservations: [],
    } as any);

    render(
      <HostReservationsPanel filterType="UPCOMING" onFilterChange={jest.fn()} />
    );

    expect(await screen.findByTestId("shared-empty-state")).toHaveTextContent(
      "아직 예약이 없습니다."
    );
  });

  it("renders labels for payment-completed and completed reservations", async () => {
    jest.mocked(reservationApi.getHostReservations).mockResolvedValue({
      page_info: {
        has_next: false,
        next_cursor: null,
      },
      reservations: [
        createHostReservation(1, ReservationStatus.PAYMENT_COMPLETED),
        createHostReservation(2, ReservationStatus.COMPLETED),
      ],
    } as any);

    render(
      <HostReservationsPanel filterType="UPCOMING" onFilterChange={jest.fn()} />
    );

    expect(await screen.findByText("결제 완료")).toBeInTheDocument();
    expect(screen.getByText("이용 완료")).toBeInTheDocument();
  });
});
