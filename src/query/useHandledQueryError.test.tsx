import { renderHook } from "@testing-library/react";
import { useHandledQueryError } from "./useHandledQueryError";

describe("useHandledQueryError", () => {
  it("handles a query error once per errorUpdatedAt value", () => {
    const onError = jest.fn();
    const error = new Error("first failure");

    const { rerender } = renderHook(
      ({ errorUpdatedAt }) =>
        useHandledQueryError({
          error,
          errorUpdatedAt,
          isError: true,
          onError,
        }),
      {
        initialProps: { errorUpdatedAt: 10 },
      },
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(error);

    rerender({ errorUpdatedAt: 10 });
    expect(onError).toHaveBeenCalledTimes(1);

    rerender({ errorUpdatedAt: 11 });
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("does not handle null or inactive error state", () => {
    const onError = jest.fn();

    renderHook(() =>
      useHandledQueryError({
        error: null,
        errorUpdatedAt: 1,
        isError: false,
        onError,
      }),
    );

    expect(onError).not.toHaveBeenCalled();
  });
});
