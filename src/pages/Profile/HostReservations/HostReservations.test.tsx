import React from "react";
import { render, screen } from "@testing-library/react";
import { reservationApi } from "../../../api";
import HostReservations from "./HostReservations";

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock("../../../api", () => ({
  reservationApi: {
    getHostReservations: jest.fn(),
  },
}));

jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({
    error: null,
    clearError: jest.fn(),
    handleError: jest.fn(),
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
  jest.mocked(reservationApi.getHostReservations).mockReset();
  window.IntersectionObserver = jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
    observe: jest.fn(),
    unobserve: jest.fn(),
  }));
});

describe("HostReservations", () => {
  it("renders shared loading state while fetching reservations", async () => {
    jest.mocked(reservationApi.getHostReservations).mockResolvedValue({
      page_info: {
        has_next: false,
        next_cursor: null,
      },
      reservations: [],
    } as any);

    render(
      <HostReservations filterType="UPCOMING" onFilterChange={jest.fn()} />
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
      <HostReservations filterType="UPCOMING" onFilterChange={jest.fn()} />
    );

    expect(await screen.findByTestId("shared-empty-state")).toHaveTextContent(
      "아직 예약이 없습니다."
    );
  });
});
