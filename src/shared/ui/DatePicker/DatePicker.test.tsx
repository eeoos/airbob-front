import * as fs from "fs";
import * as path from "path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Mock } from "vitest";
import { DatePicker } from "./DatePicker";
import styles from "./DatePicker.module.css";

type DatePickerProps = React.ComponentProps<typeof DatePicker>;
type DatePickerTestProps = DatePickerProps & {
  onClose: Mock<() => void>;
  onDateSelect: Mock<(checkIn: Date | null, checkOut: Date | null) => void>;
};
type DatePickerOverrides = Partial<
  Omit<DatePickerProps, "onClose" | "onDateSelect">
> &
  Partial<Pick<DatePickerTestProps, "onClose" | "onDateSelect">>;

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const readProjectFile = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const createDefaultProps = (): DatePickerTestProps => ({
  checkIn: null,
  checkOut: null,
  onClose: vi.fn<() => void>(),
  onDateSelect: vi.fn<(checkIn: Date | null, checkOut: Date | null) => void>(),
});

const renderDatePicker = (overrides: DatePickerOverrides = {}) => {
  const props: DatePickerTestProps = {
    ...createDefaultProps(),
    ...overrides,
  };

  const view = render(<DatePicker {...props} />);

  return { props, ...view };
};

describe("DatePicker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders two named month grids with Korean weekday headers", () => {
    renderDatePicker();

    const julyGrid = screen.getByRole("grid", { name: "2026년 7월" });
    const augustGrid = screen.getByRole("grid", { name: "2026년 8월" });

    expect(julyGrid).toBeInTheDocument();
    expect(augustGrid).toBeInTheDocument();
    expect(
      within(julyGrid).getByRole("columnheader", { name: "일요일" }),
    ).toHaveTextContent("일");
    expect(
      within(julyGrid).getByRole("columnheader", { name: "토요일" }),
    ).toHaveTextContent("토");
  });

  it("renders selectable dates as grid cells backed by buttons", () => {
    renderDatePicker();

    const dateCell = screen.getByRole("gridcell", {
      name: "2026년 7월 15일 수요일",
    });

    expect(dateCell).toHaveAttribute("type", "button");
    expect(dateCell.tagName).toBe("BUTTON");
  });

  it("labels month navigation buttons for screen readers", () => {
    render(
      <DatePicker
        checkIn={null}
        checkOut={null}
        onClose={vi.fn()}
        onDateSelect={vi.fn()}
        unavailableDates={[]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "이전 달 보기" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "다음 달 보기" }),
    ).toBeInTheDocument();
  });

  it("moves the visible two-month window without moving focus off navigation", async () => {
    renderDatePicker();
    const nextMonthButton = screen.getByRole("button", {
      name: "다음 달 보기",
    });

    nextMonthButton.focus();
    await userEvent.click(nextMonthButton);

    expect(screen.getByRole("grid", { name: "2026년 8월" })).toBeVisible();
    expect(screen.getByRole("grid", { name: "2026년 9월" })).toBeVisible();
    expect(nextMonthButton).toHaveFocus();
    expect(
      screen.getByRole("gridcell", { name: "2026년 8월 10일 월요일" }),
    ).toHaveAttribute("tabindex", "0");
  });

  it("clamps repeated previous-month navigation to a window containing the roving tab stop", async () => {
    renderDatePicker();
    const previousMonthButton = screen.getByRole("button", {
      name: "이전 달 보기",
    });

    await userEvent.click(previousMonthButton);
    await userEvent.click(previousMonthButton);

    expect(screen.getByRole("grid", { name: "2026년 6월" })).toBeVisible();
    expect(screen.getByRole("grid", { name: "2026년 7월" })).toBeVisible();
    expect(
      screen.queryByRole("grid", { name: "2026년 5월" }),
    ).not.toBeInTheDocument();
    expect(previousMonthButton).toHaveFocus();

    const tabStops = screen
      .getAllByRole("gridcell")
      .filter((cell) => cell.getAttribute("tabindex") === "0");

    expect(tabStops).toHaveLength(1);
    expect(tabStops[0]).toHaveAccessibleName("2026년 7월 10일 금요일");
  });

  it("does not call onDateSelect for disabled past or unavailable dates", async () => {
    const { props } = renderDatePicker({
      unavailableDates: ["2026-07-12"],
    });

    const pastDate = screen.getByRole("gridcell", {
      name: "2026년 7월 9일 목요일",
    });
    const unavailableDate = screen.getByRole("gridcell", {
      name: "2026년 7월 12일 일요일",
    });

    expect(pastDate).toBeDisabled();
    expect(unavailableDate).toBeDisabled();

    await userEvent.click(pastDate);
    await userEvent.click(unavailableDate);

    expect(props.onDateSelect).not.toHaveBeenCalled();
  });

  it("uses a supplied server window instead of the browser's local today", () => {
    renderDatePicker({
      selectionWindow: {
        startInclusive: "2026-07-05",
        endExclusive: "2026-07-20",
      },
    });

    expect(
      screen.getByRole("gridcell", { name: "2026년 7월 4일 토요일" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("gridcell", { name: "2026년 7월 5일 일요일" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("gridcell", { name: "2026년 7월 20일 월요일" }),
    ).toBeDisabled();
  });

  it("treats disabled ranges as half-open stay nights", () => {
    renderDatePicker({
      checkIn: new Date(2026, 6, 12),
      disabledRanges: [
        { startInclusive: "2026-07-15", endExclusive: "2026-07-18" },
      ],
      selectionWindow: {
        startInclusive: "2026-07-10",
        endExclusive: "2026-07-20",
      },
    });

    expect(
      screen.getByRole("gridcell", { name: "2026년 7월 15일 수요일" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("gridcell", { name: "2026년 7월 16일 목요일" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("gridcell", { name: "2026년 7월 18일 토요일" }),
    ).toBeDisabled();
  });

  it("allows checkout exactly at the server window end", () => {
    renderDatePicker({
      checkIn: new Date(2026, 6, 18),
      selectionWindow: {
        startInclusive: "2026-07-10",
        endExclusive: "2026-07-20",
      },
    });

    expect(
      screen.getByRole("gridcell", { name: "2026년 7월 20일 월요일" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("gridcell", { name: "2026년 7월 21일 화요일" }),
    ).toBeDisabled();
  });

  it("does not restart a completed range from its blocked checkout boundary", async () => {
    const checkIn = new Date(2026, 6, 12);
    const checkOut = new Date(2026, 6, 15);
    const view = renderDatePicker({
      checkIn,
      disabledRanges: [
        { startInclusive: "2026-07-15", endExclusive: "2026-07-18" },
      ],
      selectionWindow: {
        startInclusive: "2026-07-10",
        endExclusive: "2026-07-20",
      },
    });
    let blockedCheckout = screen.getByRole("gridcell", {
      name: "2026년 7월 15일 수요일",
    });

    expect(blockedCheckout).toBeEnabled();
    await userEvent.click(blockedCheckout);
    expect(view.props.onDateSelect).toHaveBeenCalledTimes(1);

    view.rerender(
      <DatePicker {...view.props} checkIn={checkIn} checkOut={checkOut} />,
    );
    blockedCheckout = screen.getByRole("gridcell", {
      name: "2026년 7월 15일 수요일",
    });
    expect(blockedCheckout).toHaveAttribute("aria-selected", "true");
    expect(blockedCheckout).toBeDisabled();
    await userEvent.click(blockedCheckout);
    expect(view.props.onDateSelect).toHaveBeenCalledTimes(1);
  });

  it("treats a blocked partial check-in as display-only and restarts from the next enabled date", async () => {
    const blockedCheckIn = new Date(2026, 6, 12);
    const { props } = renderDatePicker({
      checkIn: blockedCheckIn,
      disabledRanges: [
        { startInclusive: "2026-07-12", endExclusive: "2026-07-14" },
      ],
      selectionWindow: {
        startInclusive: "2026-07-10",
        endExclusive: "2026-07-20",
      },
    });
    const displayedCheckIn = screen.getByRole("gridcell", {
      name: "2026년 7월 12일 일요일",
    });

    expect(displayedCheckIn).toHaveAttribute("aria-selected", "true");
    expect(displayedCheckIn).toBeDisabled();

    await userEvent.click(
      screen.getByRole("gridcell", {
        name: "2026년 7월 14일 화요일",
      }),
    );

    expect(props.onDateSelect).toHaveBeenCalledTimes(1);
    const selection = props.onDateSelect.mock.calls.at(0);
    const selectedCheckIn = selection?.at(0);
    if (!selectedCheckIn) throw new Error("Expected a restarted check-in date");
    expect(formatDateKey(selectedCheckIn)).toBe("2026-07-14");
    expect(selection?.at(1)).toBeNull();
  });

  it("treats an out-of-window partial check-in as display-only and restarts inside the window", async () => {
    const { props } = renderDatePicker({
      checkIn: new Date(2026, 6, 25),
      selectionWindow: {
        startInclusive: "2026-07-10",
        endExclusive: "2026-07-20",
      },
    });

    await userEvent.click(
      screen.getByRole("gridcell", {
        name: "2026년 7월 14일 화요일",
      }),
    );

    expect(props.onDateSelect).toHaveBeenCalledTimes(1);
    const selection = props.onDateSelect.mock.calls.at(0);
    const selectedCheckIn = selection?.at(0);
    if (!selectedCheckIn) throw new Error("Expected a restarted check-in date");
    expect(formatDateKey(selectedCheckIn)).toBe("2026-07-14");
    expect(selection?.at(1)).toBeNull();
  });

  it("restarts a partial check-in blocked by the legacy unavailable-date input", async () => {
    const { props } = renderDatePicker({
      checkIn: new Date(2026, 6, 12),
      unavailableDates: ["2026-07-12"],
    });

    await userEvent.click(
      screen.getByRole("gridcell", {
        name: "2026년 7월 14일 화요일",
      }),
    );

    expect(props.onDateSelect).toHaveBeenCalledTimes(1);
    const selection = props.onDateSelect.mock.calls.at(0);
    const selectedCheckIn = selection?.at(0);
    if (!selectedCheckIn) throw new Error("Expected a restarted check-in date");
    expect(formatDateKey(selectedCheckIn)).toBe("2026-07-14");
    expect(selection?.at(1)).toBeNull();
  });

  it("restarts a stale partial check-in using the browser-today minimum", async () => {
    const { props } = renderDatePicker({
      checkIn: new Date(2026, 6, 9),
    });

    await userEvent.click(
      screen.getByRole("gridcell", {
        name: "2026년 7월 14일 화요일",
      }),
    );

    expect(props.onDateSelect).toHaveBeenCalledTimes(1);
    const selection = props.onDateSelect.mock.calls.at(0);
    const selectedCheckIn = selection?.at(0);
    if (!selectedCheckIn) throw new Error("Expected a restarted check-in date");
    expect(formatDateKey(selectedCheckIn)).toBe("2026-07-14");
    expect(selection?.at(1)).toBeNull();
  });

  it("calls onDateSelect when a selectable future date is clicked", async () => {
    const { props } = renderDatePicker();

    await userEvent.click(
      screen.getByRole("gridcell", {
        name: "2026년 7월 15일 수요일",
      }),
    );

    expect(props.onDateSelect).toHaveBeenCalledTimes(1);
    const selection = props.onDateSelect.mock.calls.at(0);
    if (!selection) throw new Error("Expected a selected date range");
    const [selectedCheckIn, selectedCheckOut] = selection;
    if (!selectedCheckIn) throw new Error("Expected a selected check-in date");
    expect(formatDateKey(selectedCheckIn)).toBe("2026-07-15");
    expect(selectedCheckOut).toBeNull();
  });

  it("prevents checkout ranges from crossing the first unavailable date", async () => {
    const { props } = renderDatePicker({
      checkIn: new Date(2026, 6, 15),
      unavailableDates: ["2026-07-18", "2026-07-25"],
    });
    const firstUnavailableDate = screen.getByRole("gridcell", {
      name: "2026년 7월 18일 토요일",
    });
    const dateBeyondUnavailable = screen.getByRole("gridcell", {
      name: "2026년 7월 19일 일요일",
    });
    const dateInsideValidHoverRange = screen.getByRole("gridcell", {
      name: "2026년 7월 16일 목요일",
    });

    expect(firstUnavailableDate).toBeEnabled();
    expect(firstUnavailableDate).not.toHaveClass(styles.unavailable ?? "");
    expect(dateBeyondUnavailable).toBeDisabled();

    await userEvent.click(dateBeyondUnavailable);
    expect(props.onDateSelect).not.toHaveBeenCalled();

    await userEvent.hover(firstUnavailableDate);
    expect(dateInsideValidHoverRange).toHaveClass(styles.inRange ?? "");

    await userEvent.click(firstUnavailableDate);
    expect(props.onDateSelect).toHaveBeenCalledTimes(1);
    const selection = props.onDateSelect.mock.calls.at(0);
    if (!selection) throw new Error("Expected a selected date range");
    const [selectedCheckIn, selectedCheckOut] = selection;
    if (!selectedCheckIn || !selectedCheckOut) {
      throw new Error("Expected both check-in and check-out dates");
    }
    expect(formatDateKey(selectedCheckIn)).toBe("2026-07-15");
    expect(formatDateKey(selectedCheckOut)).toBe("2026-07-18");

    await userEvent.unhover(firstUnavailableDate);
    await userEvent.hover(dateBeyondUnavailable);
    expect(dateInsideValidHoverRange).not.toHaveClass(styles.inRange ?? "");
  });

  it("keeps the first unavailable day as the only valid checkout when it is next", () => {
    renderDatePicker({
      checkIn: new Date(2026, 6, 15),
      unavailableDates: ["2026-07-16"],
    });

    const firstUnavailableDate = screen.getByRole("gridcell", {
      name: "2026년 7월 16일 목요일",
    });
    const dateBeyondUnavailable = screen.getByRole("gridcell", {
      name: "2026년 7월 17일 금요일",
    });
    const tabStops = screen
      .getAllByRole("gridcell")
      .filter((cell) => cell.getAttribute("tabindex") === "0");

    expect(firstUnavailableDate).toBeEnabled();
    expect(dateBeyondUnavailable).toBeDisabled();
    expect(tabStops).toEqual([firstUnavailableDate]);
  });

  it("keeps exactly one enabled date in the roving tab order", () => {
    renderDatePicker({ unavailableDates: ["2026-07-10"] });

    const dateCells = screen.getAllByRole("gridcell");
    const tabStops = dateCells.filter(
      (cell) => cell.getAttribute("tabindex") === "0",
    );

    expect(tabStops).toHaveLength(1);
    expect(tabStops[0]).toBeEnabled();
    expect(tabStops[0]).toHaveAccessibleName("2026년 7월 11일 토요일");
  });

  it("moves the roving tab stop when a new check-in disables the focused date", async () => {
    const view = renderDatePicker();
    const checkIn = new Date(2026, 6, 15);

    await userEvent.click(
      screen.getByRole("gridcell", {
        name: "2026년 7월 15일 수요일",
      }),
    );
    view.rerender(<DatePicker {...view.props} checkIn={checkIn} />);

    const nextValidDate = screen.getByRole("gridcell", {
      name: "2026년 7월 16일 목요일",
    });
    const tabStops = screen
      .getAllByRole("gridcell")
      .filter((cell) => cell.getAttribute("tabindex") === "0");

    expect(tabStops).toEqual([nextValidDate]);
    expect(nextValidDate).toHaveFocus();
  });

  it("moves through valid cells with arrows, week edges, and page keys", async () => {
    renderDatePicker({ unavailableDates: ["2026-07-11"] });

    expect(
      screen.getByRole("gridcell", { name: "2026년 7월 10일 금요일" }),
    ).toHaveFocus();

    await userEvent.keyboard("{ArrowRight}");
    expect(
      screen.getByRole("gridcell", { name: "2026년 7월 12일 일요일" }),
    ).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}{Home}{End}");
    expect(
      screen.getByRole("gridcell", { name: "2026년 7월 25일 토요일" }),
    ).toHaveFocus();

    await userEvent.keyboard("{PageDown}");
    expect(
      screen.getByRole("gridcell", { name: "2026년 8월 25일 화요일" }),
    ).toHaveFocus();

    await userEvent.keyboard("{PageDown}");
    expect(
      screen.getByRole("gridcell", { name: "2026년 9월 25일 금요일" }),
    ).toHaveFocus();
    expect(screen.getByRole("grid", { name: "2026년 9월" })).toBeVisible();

    await userEvent.keyboard("{PageUp}");
    expect(
      screen.getByRole("gridcell", { name: "2026년 8월 25일 화요일" }),
    ).toHaveFocus();

    await userEvent.keyboard("{PageUp}");
    expect(
      screen.getByRole("gridcell", { name: "2026년 7월 25일 토요일" }),
    ).toHaveFocus();
  });

  it("moves backward with left and up arrows without landing on disabled dates", async () => {
    renderDatePicker({ unavailableDates: ["2026-07-17"] });
    const julyTwentyFourth = screen.getByRole("gridcell", {
      name: "2026년 7월 24일 금요일",
    });

    julyTwentyFourth.focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(
      screen.getByRole("gridcell", { name: "2026년 7월 23일 목요일" }),
    ).toHaveFocus();

    await userEvent.keyboard("{ArrowUp}");
    expect(
      screen.getByRole("gridcell", { name: "2026년 7월 16일 목요일" }),
    ).toHaveFocus();
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("selects the focused date with %s", async (_keyName, key) => {
    const { props } = renderDatePicker();
    const dateButton = screen.getByRole("gridcell", {
      name: "2026년 7월 16일 목요일",
    });

    dateButton.focus();
    await userEvent.keyboard(key);

    expect(props.onDateSelect).toHaveBeenCalledTimes(1);
    const selection = props.onDateSelect.mock.calls.at(0);
    const selectedCheckIn = selection?.at(0);
    if (!selectedCheckIn) throw new Error("Expected a selected check-in date");
    expect(formatDateKey(selectedCheckIn)).toBe("2026-07-16");
  });

  it("exposes selected endpoints and announces the completed range", async () => {
    const checkIn = new Date(2026, 6, 15);
    const { rerender, props } = renderDatePicker({ checkIn });

    await userEvent.click(
      screen.getByRole("gridcell", {
        name: "2026년 7월 18일 토요일",
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "2026년 7월 15일 수요일부터 2026년 7월 18일 토요일까지 선택됨",
    );

    rerender(
      <DatePicker
        {...props}
        checkIn={checkIn}
        checkOut={new Date(2026, 6, 18)}
      />,
    );

    expect(
      screen.getByRole("gridcell", {
        name: "2026년 7월 15일 수요일",
      }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("gridcell", {
        name: "2026년 7월 18일 토요일",
      }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("closes with Escape through the dedicated consumer callback", async () => {
    const onEscape = vi.fn();
    const { props } = renderDatePicker({ onEscape });

    await userEvent.keyboard("{Escape}");

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("keeps mobile date buttons at the shared touch target size", () => {
    const css = readProjectFile(
      "src/shared/ui/DatePicker/DatePicker.module.css",
    );

    expect(css).toMatch(
      /@media \(max-width: 768px\)[\s\S]*\.days\s*\{[\s\S]*grid-auto-rows:\s*minmax\(var\(--control-touch-target\), auto\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 768px\)[\s\S]*\.day\s*\{[\s\S]*min-height:\s*var\(--control-touch-target\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 480px\)[\s\S]*\.day\s*\{[\s\S]*min-height:\s*var\(--control-touch-target\)/,
    );
  });
});
