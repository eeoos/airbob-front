import React from "react";
import { render, screen } from "@testing-library/react";
import { reservationApi } from "../../../api";
import GuestTrips from "./GuestTrips";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock("../../../api", () => ({
  reservationApi: {
    getMyReservations: jest.fn(),
  },
}));

jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({
    error: null,
    clearError: mockClearError,
    handleError: mockHandleError,
  }),
}));

jest.mock("../../../components/ErrorToast", () => ({
  ErrorToast: ({ message }: { message: string }) => (
    <div role="alert">{message}</div>
  ),
}));

jest.mock("../../../shared/ui", () => {
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

beforeEach(() => {
  mockClearError.mockReset();
  mockHandleError.mockReset();
  jest.mocked(reservationApi.getMyReservations).mockReset();
  window.IntersectionObserver = jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
    observe: jest.fn(),
    unobserve: jest.fn(),
  }));
});

describe("GuestTrips", () => {
  it("renders shared loading state while fetching reservations", async () => {
    jest.mocked(reservationApi.getMyReservations).mockResolvedValue({
      page_info: {
        has_next: false,
        next_cursor: null,
      },
      reservations: [],
    } as any);

    render(<GuestTrips filterType="UPCOMING" />);

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

    render(<GuestTrips filterType="UPCOMING" />);

    expect(await screen.findByTestId("shared-empty-state")).toHaveTextContent(
      "아직 예약한 여행이 없습니다."
    );
  });
});
