import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Tabs } from "./Tabs";

const items = [
  { value: "upcoming", label: "다가올 여행" },
  { value: "past", label: "이전 여행" },
  { value: "cancelled", label: "취소된 여행" },
] as const;

function TabsFixture() {
  const [value, setValue] = React.useState<(typeof items)[number]["value"]>(
    "upcoming"
  );

  return (
    <Tabs
      ariaLabel="프로필 탭"
      items={items}
      value={value}
      onValueChange={setValue}
    />
  );
}

function VerticalTabsFixture() {
  const [value, setValue] = React.useState<(typeof items)[number]["value"]>(
    "upcoming"
  );

  return (
    <Tabs
      ariaLabel="프로필 사이드바"
      items={items}
      orientation="vertical"
      value={value}
      onValueChange={setValue}
    />
  );
}

describe("Tabs", () => {
  it("renders accessible tabs with selected state", () => {
    render(
      <Tabs
        ariaLabel="예약 필터"
        items={items}
        value="past"
        onValueChange={jest.fn()}
      />
    );

    expect(screen.getByRole("tablist", { name: "예약 필터" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "이전 여행" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "다가올 여행" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  it("delegates click changes", async () => {
    const onValueChange = jest.fn();

    render(
      <Tabs
        ariaLabel="예약 필터"
        items={items}
        value="upcoming"
        onValueChange={onValueChange}
      />
    );

    await userEvent.click(screen.getByRole("tab", { name: "이전 여행" }));

    expect(onValueChange).toHaveBeenCalledWith("past");
  });

  it("supports arrow and edge-key navigation", async () => {
    render(<TabsFixture />);

    const upcomingTab = screen.getByRole("tab", { name: "다가올 여행" });
    upcomingTab.focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "이전 여행" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "이전 여행" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "취소된 여행" })).toHaveFocus();

    await userEvent.keyboard("{Home}");
    expect(upcomingTab).toHaveFocus();
  });

  it("supports vertical orientation and up/down arrow navigation", async () => {
    render(<VerticalTabsFixture />);

    const tabList = screen.getByRole("tablist", { name: "프로필 사이드바" });
    const upcomingTab = screen.getByRole("tab", { name: "다가올 여행" });

    expect(tabList).toHaveAttribute("aria-orientation", "vertical");

    upcomingTab.focus();

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("tab", { name: "이전 여행" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "이전 여행" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await userEvent.keyboard("{ArrowUp}");
    expect(upcomingTab).toHaveFocus();
  });

  it("keeps the first enabled tab tabbable when value is stale", () => {
    render(
      <Tabs
        ariaLabel="예약 필터"
        items={items}
        value="missing"
        onValueChange={jest.fn()}
      />
    );

    expect(screen.getByRole("tab", { name: "다가올 여행" })).toHaveAttribute(
      "tabindex",
      "0"
    );
    expect(screen.getByRole("tab", { name: "다가올 여행" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
  });

  it("keeps the first enabled tab tabbable when the selected tab is disabled", () => {
    render(
      <Tabs
        ariaLabel="예약 필터"
        items={[
          { value: "upcoming", label: "다가올 여행" },
          { value: "past", label: "이전 여행", disabled: true },
          { value: "cancelled", label: "취소된 여행" },
        ]}
        value="past"
        onValueChange={jest.fn()}
      />
    );

    expect(screen.getByRole("tab", { name: "다가올 여행" })).toHaveAttribute(
      "tabindex",
      "0"
    );
    expect(screen.getByRole("tab", { name: "이전 여행" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "이전 여행" })).toHaveAttribute(
      "tabindex",
      "-1"
    );
  });
});
