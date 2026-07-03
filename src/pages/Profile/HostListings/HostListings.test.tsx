import React from "react";
import { render, screen } from "@testing-library/react";
import { accommodationApi } from "../../../api";
import HostListings from "./HostListings";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();

jest.mock("../../../api", () => ({
  accommodationApi: {
    getMyAccommodations: jest.fn(),
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

jest.mock("../../../features/accommodations/components/AccommodationActionModal", () => ({
  AccommodationActionModal: () => null,
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
  jest.mocked(accommodationApi.getMyAccommodations).mockReset();
  window.IntersectionObserver = jest.fn().mockImplementation(() => ({
    disconnect: jest.fn(),
    observe: jest.fn(),
    unobserve: jest.fn(),
  }));
});

describe("HostListings", () => {
  it("renders shared loading state while fetching accommodations", async () => {
    jest.mocked(accommodationApi.getMyAccommodations).mockResolvedValue({
      accommodations: [],
      page_info: {
        has_next: false,
        next_cursor: null,
      },
    } as any);

    render(<HostListings onStatusChange={jest.fn()} />);

    expect(screen.getByTestId("shared-loading-state")).toHaveTextContent(
      "로딩 중..."
    );
    await screen.findByTestId("shared-empty-state");
  });

  it("renders shared empty state when the host has no accommodations", async () => {
    jest.mocked(accommodationApi.getMyAccommodations).mockResolvedValue({
      accommodations: [],
      page_info: {
        has_next: false,
        next_cursor: null,
      },
    } as any);

    render(<HostListings onStatusChange={jest.fn()} />);

    expect(await screen.findByTestId("shared-empty-state")).toHaveTextContent(
      "아직 숙소가 없습니다."
    );
  });
});
