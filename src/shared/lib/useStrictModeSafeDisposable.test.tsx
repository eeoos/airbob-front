import { StrictMode } from "react";
import { act, render } from "@testing-library/react";
import { useStrictModeSafeDisposable } from "./useStrictModeSafeDisposable";

const Harness = ({ resource }: { resource: { dispose(): void } }) => {
  useStrictModeSafeDisposable(resource);
  return null;
};

describe("useStrictModeSafeDisposable", () => {
  it("keeps the committed resource alive through StrictMode effect replay", async () => {
    const resource = { dispose: jest.fn() };
    const view = render(
      <StrictMode>
        <Harness resource={resource} />
      </StrictMode>,
    );

    await act(async () => Promise.resolve());
    expect(resource.dispose).not.toHaveBeenCalled();

    view.unmount();
    await act(async () => Promise.resolve());
    expect(resource.dispose).toHaveBeenCalledTimes(1);
  });

  it("disposes the replaced generation but not its replacement", async () => {
    const previous = { dispose: jest.fn() };
    const current = { dispose: jest.fn() };
    const view = render(<Harness resource={previous} />);

    view.rerender(<Harness resource={current} />);
    await act(async () => Promise.resolve());

    expect(previous.dispose).toHaveBeenCalledTimes(1);
    expect(current.dispose).not.toHaveBeenCalled();
  });
});
