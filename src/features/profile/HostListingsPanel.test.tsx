import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { accommodationApi } from "../../api";
import { HostListingsPanel } from "./HostListingsPanel";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();

jest.mock("../../api", () => ({
  accommodationApi: {
    getMyAccommodations: jest.fn(),
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

jest.mock("../accommodations/appShell", () => ({
  AccommodationActionModal: (props: any) => {
    return props.isOpen ? (
      <div role="dialog">{props.accommodation?.name}</div>
    ) : null;
  },
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

const renderPanel = (onStatusChange = jest.fn()) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <HostListingsPanel onStatusChange={onStatusChange} />
    </QueryClientProvider>
  );
};

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

describe("HostListingsPanel", () => {
  it("renders shared loading state while fetching accommodations", async () => {
    jest.mocked(accommodationApi.getMyAccommodations).mockResolvedValue({
      accommodations: [],
      page_info: {
        has_next: false,
        next_cursor: null,
      },
    } as any);

    renderPanel();

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

    renderPanel();

    expect(await screen.findByTestId("shared-empty-state")).toHaveTextContent(
      "아직 숙소가 없습니다."
    );
  });

  it("opens accommodation management from a semantic listing card button", async () => {
    jest.mocked(accommodationApi.getMyAccommodations).mockResolvedValue({
      accommodations: [
        {
          id: 7,
          name: "바다 숙소",
          thumbnail_url: null,
          status: "PUBLISHED",
          type: "ENTIRE_PLACE",
          address_summary: {
            country: "대한민국",
            state: null,
            city: "부산",
            district: "해운대구",
          },
          created_at: "2026-07-01T00:00:00Z",
        },
      ],
      page_info: {
        has_next: false,
        next_cursor: null,
      },
    } as any);

    renderPanel();

    const card = await screen.findByRole("button", {
      name: "바다 숙소 숙소 관리 열기",
    });

    expect(card).toHaveClass("accommodationCard");

    fireEvent.click(card);

    expect(screen.getByRole("dialog")).toHaveTextContent("바다 숙소");
  });
});
