import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileShell } from "./ProfileShell";

describe("ProfileShell", () => {
  const setViewport = (matches: boolean) => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      matches: query.includes("max-width: 1024px") ? matches : false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
    }));
  };

  beforeEach(() => setViewport(false));

  it("renders guest navigation and delegates mode and tab changes", async () => {
    const onModeChange = vi.fn();
    const onTabChange = vi.fn();

    render(
      <ProfileShell
        mode="guest"
        activeTab="upcoming"
        onModeChange={onModeChange}
        onTabChange={onTabChange}
      >
        <div>profile content</div>
      </ProfileShell>,
    );

    expect(screen.getByText("프로필")).toBeInTheDocument();
    expect(screen.getByText("profile content")).toBeInTheDocument();
    expect(
      screen.getByRole("tablist", { name: "게스트 프로필" }),
    ).toHaveAttribute("aria-orientation", "vertical");

    await userEvent.click(screen.getByRole("tab", { name: "이전 여행" }));
    await userEvent.click(screen.getByRole("tab", { name: "호스트" }));

    expect(onTabChange).toHaveBeenCalledWith("past");
    expect(onModeChange).toHaveBeenCalledWith("host");
  });

  it("renders host navigation and delegates section changes", async () => {
    const onTabChange = vi.fn();

    render(
      <ProfileShell
        mode="host"
        activeTab="listings"
        onModeChange={vi.fn()}
        onTabChange={onTabChange}
      >
        <div>host content</div>
      </ProfileShell>,
    );

    expect(
      screen.getByRole("tablist", { name: "호스트 프로필" }),
    ).toHaveAttribute("aria-orientation", "vertical");

    await userEvent.click(screen.getByRole("tab", { name: "예약 관리" }));

    expect(onTabChange).toHaveBeenCalledWith("reservations");
  });

  it("uses horizontal tab semantics when the navigation reflows", () => {
    setViewport(true);

    render(
      <ProfileShell
        mode="guest"
        activeTab="upcoming"
        onModeChange={vi.fn()}
        onTabChange={vi.fn()}
      >
        <div>mobile content</div>
      </ProfileShell>,
    );

    expect(
      screen.getByRole("tablist", { name: "게스트 프로필" }),
    ).toHaveAttribute("aria-orientation", "horizontal");
  });
});
