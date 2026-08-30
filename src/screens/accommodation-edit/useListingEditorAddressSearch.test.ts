import { act, renderHook } from "@testing-library/react";
import { useListingEditorAddressSearch } from "./useListingEditorAddressSearch";

const deferred = <Value,>() => {
  let resolve!: (value: Value) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
};

const address = {
  postalCode: "06236",
  country: "대한민국",
  state: "서울특별시",
  city: "서울특별시",
  district: "강남구",
  street: "테헤란로 123",
  detail: "",
};

describe("useListingEditorAddressSearch", () => {
  it("applies only the latest address search completion", async () => {
    const first = deferred<typeof address>();
    const second = deferred<typeof address>();
    const search = jest
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const onAddressSelected = jest.fn();
    const { result } = renderHook(() =>
      useListingEditorAddressSearch({
        onAddressSelected,
        onError: jest.fn(),
        port: { search },
      }),
    );

    act(() => result.current.openAddressSearch());
    const firstSignal = search.mock.calls[0][0].signal as AbortSignal;
    act(() => result.current.openAddressSearch());
    expect(firstSignal.aborted).toBe(true);

    await act(async () => {
      first.resolve(address);
      second.resolve({ ...address, detail: "latest" });
      await Promise.all([first.promise, second.promise]);
    });
    expect(onAddressSelected).toHaveBeenCalledTimes(1);
    expect(onAddressSelected).toHaveBeenCalledWith({
      ...address,
      detail: "latest",
    });
  });

  it("suppresses a failed search after unmount", async () => {
    const pending = deferred<typeof address>();
    const onError = jest.fn();
    const { result, unmount } = renderHook(() =>
      useListingEditorAddressSearch({
        onAddressSelected: jest.fn(),
        onError,
        port: { search: () => pending.promise },
      }),
    );
    act(() => result.current.openAddressSearch());
    unmount();

    await act(async () => {
      pending.reject(new Error("unavailable"));
      await pending.promise.catch(() => undefined);
    });
    expect(onError).not.toHaveBeenCalled();
  });
});
