import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileShell } from "./ProfileShell";

describe("ProfileShell", () => {
  it("renders guest navigation and delegates tab changes", async () => {
    const onGuestTabChange = jest.fn();

    render(
      <ProfileShell
        mode="guest"
        activeTab="upcoming"
        onModeChange={jest.fn()}
        onGuestTabChange={onGuestTabChange}
        onHostListingsClick={jest.fn()}
        onHostReservationsClick={jest.fn()}
      >
        <div>profile content</div>
      </ProfileShell>,
    );

    expect(screen.getByText("profile content")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "이전 여행" }));

    expect(onGuestTabChange).toHaveBeenCalledWith("past");
  });

  it("renders host navigation and delegates section changes", async () => {
    const onHostReservationsClick = jest.fn();

    render(
      <ProfileShell
        mode="host"
        activeTab="listings-published"
        onModeChange={jest.fn()}
        onGuestTabChange={jest.fn()}
        onHostListingsClick={jest.fn()}
        onHostReservationsClick={onHostReservationsClick}
      >
        <div>host content</div>
      </ProfileShell>,
    );

    await userEvent.click(screen.getByRole("button", { name: "예약 관리" }));

    expect(onHostReservationsClick).toHaveBeenCalled();
  });
});
