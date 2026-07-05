import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { reservationApi } from "../../api";
import { GuestTripsPanel } from "./GuestTripsPanel";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();
const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("../../api", () => ({
  reservationApi: {
    getMyReservations: jest.fn(),
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
  const actual = jest.requireActual("../../shared/ui");

  return {
    ...actual,
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

beforeEach(() => {
  mockClearError.mockReset();
  mockHandleError.mockReset();
  mockNavigate.mockReset();
  jest.mocked(reservationApi.getMyReservations).mockReset();
  window.IntersectionObserver = jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
    observe: jest.fn(),
    unobserve: jest.fn(),
  }));
});

describe("GuestTripsPanel", () => {
  it("renders shared loading state while fetching reservations", async () => {
    jest.mocked(reservationApi.getMyReservations).mockResolvedValue({
      page_info: {
        has_next: false,
        next_cursor: null,
      },
      reservations: [],
    } as any);

    render(<GuestTripsPanel filterType="UPCOMING" />);

    expect(screen.getByTestId("shared-loading-state")).toHaveTextContent(
      "로딩 중..."
    );
    await screen.findByTestId("shared-empty-state");
  });

  it("renders shared empty state when the guest has no trips", async () => {
    jest.mocked(reservationApi.getMyReservations).mockResolvedValue({
      page_info: {
        has_next: false,
        next_cursor: null,
      },
      reservations: [],
    } as any);

    render(<GuestTripsPanel filterType="UPCOMING" />);

    expect(await screen.findByTestId("shared-empty-state")).toHaveTextContent(
      "아직 예약한 여행이 없습니다."
    );
  });

  it("navigates from a semantic reservation card button", async () => {
    jest.mocked(reservationApi.getMyReservations).mockResolvedValue({
      page_info: {
        has_next: false,
        next_cursor: null,
      },
      reservations: [
        {
          reservation_id: 11,
          reservation_uid: "reservation-11",
          check_in_date: "2026-07-10",
          check_out_date: "2026-07-12",
          created_at: "2026-07-01T00:00:00Z",
          accommodation: {
            id: 5,
            name: "산장 숙소",
            thumbnail_url: null,
          },
        },
      ],
    } as any);

    render(<GuestTripsPanel filterType="UPCOMING" />);

    const card = await screen.findByRole("button", {
      name: "산장 숙소 예약 상세 보기",
    });

    expect(card).toHaveClass("reservationCard");

    fireEvent.click(card);

    expect(mockNavigate).toHaveBeenCalledWith("/reservations/reservation-11");
  });
});
