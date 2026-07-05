import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileRoute } from "./ProfileRoute";
import type { ProfileRouteState } from "./lib/profileRouteState";

const mockSetSearchParams = jest.fn();
const buildMockProfileRouteSearchParams = (
  state: ProfileRouteState,
): URLSearchParams => {
  const params = new URLSearchParams();
  params.set("builtMode", state.mode);
  params.set("builtTab", state.tab);
  return params;
};
const mockBuildProfileRouteSearchParams = jest.fn<
  URLSearchParams,
  [ProfileRouteState]
>(buildMockProfileRouteSearchParams);

jest.mock("./lib/profileRouteState", () => {
  const actual = jest.requireActual("./lib/profileRouteState");
  return {
    ...actual,
    buildProfileRouteSearchParams: (state: ProfileRouteState) =>
      mockBuildProfileRouteSearchParams(state),
  };
});

jest.mock("../reservations/GuestTripsPanel", () => ({
  GuestTripsPanel: () => <div data-testid="guest-trips" />,
}));

jest.mock("../reservations/HostReservationsPanel", () => ({
  HostReservationsPanel: () => <div data-testid="host-reservations" />,
}));

jest.mock("./HostListingsPanel", () => ({
  HostListingsPanel: ({
    onStatusChange,
  }: {
    onStatusChange: (status: "DRAFT") => void;
  }) => (
    <button type="button" onClick={() => onStatusChange("DRAFT")}>
      draft listings
    </button>
  ),
}));

describe("ProfileRoute", () => {
  beforeEach(() => {
    mockSetSearchParams.mockReset();
    mockBuildProfileRouteSearchParams.mockClear();
    mockBuildProfileRouteSearchParams.mockImplementation(
      buildMockProfileRouteSearchParams,
    );
  });

  it("uses route-state builder when switching to host mode", async () => {
    render(
      <ProfileRoute
        searchParams={new URLSearchParams("")}
        setSearchParams={mockSetSearchParams}
      />,
    );

    const modeTabs = within(
      screen.getByRole("tablist", { name: "프로필 모드" }),
    );

    await userEvent.click(modeTabs.getByRole("tab", { name: "호스트" }));

    expect(mockBuildProfileRouteSearchParams).toHaveBeenCalledWith({
      mode: "host",
      tab: "listings",
    });
    expect(mockSetSearchParams).toHaveBeenCalledWith(
      new URLSearchParams("builtMode=host&builtTab=listings"),
      { replace: true },
    );
  });

  it("maps host listing status changes back into route state", async () => {
    render(
      <ProfileRoute
        searchParams={new URLSearchParams("mode=host&tab=listings")}
        setSearchParams={mockSetSearchParams}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "draft listings" }),
    );

    expect(mockBuildProfileRouteSearchParams).toHaveBeenCalledWith({
      mode: "host",
      tab: "listings-draft",
    });
  });
});
