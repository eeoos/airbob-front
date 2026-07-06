import * as fs from "fs";
import * as path from "path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DatePicker from "./DatePicker";

type DatePickerProps = React.ComponentProps<typeof DatePicker>;
type DatePickerTestProps = DatePickerProps & {
  onClose: jest.Mock<void, []>;
  onDateSelect: jest.Mock<void, [Date | null, Date | null]>;
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
  onClose: jest.fn<void, []>(),
  onDateSelect: jest.fn<void, [Date | null, Date | null]>(),
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
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-10T12:00:00"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders selectable date cells as buttons", () => {
    renderDatePicker();

    expect(screen.getByRole("button", { name: "2026-07-15" })).toHaveAttribute(
      "type",
      "button"
    );
  });

  it("labels month navigation buttons for screen readers", () => {
    render(
      <DatePicker
        checkIn={null}
        checkOut={null}
        onClose={jest.fn()}
        onDateSelect={jest.fn()}
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

  it("does not call onDateSelect for disabled past or unavailable dates", async () => {
    const { props } = renderDatePicker({
      unavailableDates: ["2026-07-12"],
    });

    const pastDate = screen.getByRole("button", { name: "2026-07-09" });
    const unavailableDate = screen.getByRole("button", {
      name: "2026-07-12",
    });

    expect(pastDate).toBeDisabled();
    expect(unavailableDate).toBeDisabled();

    await userEvent.click(pastDate);
    await userEvent.click(unavailableDate);

    expect(props.onDateSelect).not.toHaveBeenCalled();
  });

  it("calls onDateSelect when a selectable future date is clicked", async () => {
    const { props } = renderDatePicker();

    await userEvent.click(screen.getByRole("button", { name: "2026-07-15" }));

    expect(props.onDateSelect).toHaveBeenCalledTimes(1);
    const [selectedCheckIn, selectedCheckOut] = props.onDateSelect.mock.calls[0];
    expect(formatDateKey(selectedCheckIn as Date)).toBe("2026-07-15");
    expect(selectedCheckOut).toBeNull();
  });

  it("uses native button keyboard semantics for selectable dates", async () => {
    const { props } = renderDatePicker();
    const dateButton = screen.getByRole("button", { name: "2026-07-16" });

    dateButton.focus();
    await userEvent.keyboard("{Enter}");

    expect(props.onDateSelect).toHaveBeenCalledTimes(1);
    const [selectedCheckIn] = props.onDateSelect.mock.calls[0];
    expect(formatDateKey(selectedCheckIn as Date)).toBe("2026-07-16");
  });

  it("keeps mobile date buttons at the shared touch target size", () => {
    const css = readProjectFile("src/components/DatePicker/DatePicker.module.css");

    expect(css).toMatch(
      /@media \(max-width: 768px\)[\s\S]*\.days\s*\{[\s\S]*grid-auto-rows:\s*minmax\(var\(--control-touch-target\), auto\)/
    );
    expect(css).toMatch(
      /@media \(max-width: 768px\)[\s\S]*\.day\s*\{[\s\S]*min-height:\s*var\(--control-touch-target\)/
    );
    expect(css).toMatch(
      /@media \(max-width: 480px\)[\s\S]*\.day\s*\{[\s\S]*min-height:\s*var\(--control-touch-target\)/
    );
  });
});
