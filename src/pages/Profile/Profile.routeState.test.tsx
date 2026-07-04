import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Profile from "./Profile";

const mockSetSearchParams = jest.fn();
let mockSearchParams = new URLSearchParams("");
const mockBuildProfileRouteSearchParams = jest.fn((state) => {
  const params = new URLSearchParams();
  params.set("builtMode", state.mode);
  params.set("builtTab", state.tab);
  return params;
});

jest.mock("react-router-dom", () => ({
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}), { virtual: true });

jest.mock("../../features/profile/lib/profileRouteState", () => {
  const actual = jest.requireActual("../../features/profile/lib/profileRouteState");

  return {
    ...actual,
    buildProfileRouteSearchParams: (state: unknown) =>
      mockBuildProfileRouteSearchParams(state),
  };
});

jest.mock("../../features/reservations", () => ({
  GuestTripsPanel: () => <div data-testid="guest-trips" />,
  HostReservationsPanel: () => <div data-testid="host-reservations" />,
}));

jest.mock("../../features/profile", () => ({
  HostListingsPanel: ({
    onStatusChange,
  }: {
    onStatusChange: (status: string) => void;
  }) => (
    <button onClick={() => onStatusChange("DRAFT")}>draft listings</button>
  ),
}));

describe("Profile route state integration", () => {
  beforeEach(() => {
    mockSetSearchParams.mockReset();
    mockBuildProfileRouteSearchParams.mockClear();
    mockBuildProfileRouteSearchParams.mockImplementation((state) => {
      const params = new URLSearchParams();
      params.set("builtMode", state.mode);
      params.set("builtTab", state.tab);
      return params;
    });
    mockSearchParams = new URLSearchParams("");
  });

  it("uses the profile route-state builder when switching to host mode", async () => {
    render(<Profile />);

    await userEvent.click(screen.getByRole("button", { name: "호스트" }));

    expect(mockBuildProfileRouteSearchParams).toHaveBeenCalledWith({
      mode: "host",
      tab: "listings",
    });
    expect(mockSetSearchParams).toHaveBeenCalledWith(
      new URLSearchParams("builtMode=host&builtTab=listings"),
      { replace: true }
    );
  });

  it("uses the profile route-state builder for detailed host listing tabs", async () => {
    mockSearchParams = new URLSearchParams("mode=host&tab=listings");

    render(<Profile />);

    await userEvent.click(screen.getByRole("button", { name: "draft listings" }));

    expect(mockBuildProfileRouteSearchParams).toHaveBeenCalledWith({
      mode: "host",
      tab: "listings-draft",
    });
    expect(mockSetSearchParams).toHaveBeenCalledWith(
      new URLSearchParams("builtMode=host&builtTab=listings-draft"),
      { replace: true }
    );
  });
});
