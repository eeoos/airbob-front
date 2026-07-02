import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CounterStepper } from "./CounterStepper";

describe("CounterStepper", () => {
  it("shows the current value", () => {
    render(
      <CounterStepper
        decrementLabel="게스트 줄이기"
        incrementLabel="게스트 늘리기"
        onChange={jest.fn()}
        value={2}
      />
    );

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("calls onChange with the next lower value", async () => {
    const handleChange = jest.fn();

    render(
      <CounterStepper
        decrementLabel="게스트 줄이기"
        incrementLabel="게스트 늘리기"
        onChange={handleChange}
        value={2}
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "게스트 줄이기" })
    );

    expect(handleChange).toHaveBeenCalledWith(1);
  });

  it("calls onChange with the next higher value", async () => {
    const handleChange = jest.fn();

    render(
      <CounterStepper
        decrementLabel="게스트 줄이기"
        incrementLabel="게스트 늘리기"
        onChange={handleChange}
        value={2}
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "게스트 늘리기" })
    );

    expect(handleChange).toHaveBeenCalledWith(3);
  });

  it("disables decrement at the minimum value", async () => {
    const handleChange = jest.fn();

    render(
      <CounterStepper
        decrementLabel="게스트 줄이기"
        incrementLabel="게스트 늘리기"
        min={1}
        onChange={handleChange}
        value={1}
      />
    );

    const decrementButton = screen.getByRole("button", {
      name: "게스트 줄이기",
    });

    expect(decrementButton).toBeDisabled();
    await userEvent.click(decrementButton);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("defaults the minimum value to zero", () => {
    render(
      <CounterStepper
        decrementLabel="게스트 줄이기"
        incrementLabel="게스트 늘리기"
        onChange={jest.fn()}
        value={0}
      />
    );

    expect(
      screen.getByRole("button", { name: "게스트 줄이기" })
    ).toBeDisabled();
  });

  it("disables increment at the maximum value", async () => {
    const handleChange = jest.fn();

    render(
      <CounterStepper
        decrementLabel="게스트 줄이기"
        incrementLabel="게스트 늘리기"
        max={3}
        onChange={handleChange}
        value={3}
      />
    );

    const incrementButton = screen.getByRole("button", {
      name: "게스트 늘리기",
    });

    expect(incrementButton).toBeDisabled();
    await userEvent.click(incrementButton);
    expect(handleChange).not.toHaveBeenCalled();
  });
});
