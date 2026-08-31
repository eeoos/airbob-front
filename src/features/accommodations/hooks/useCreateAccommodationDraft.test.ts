import { act, renderHook, waitFor } from "@testing-library/react";
import { AppError } from "../../../platform/http/errors";
import type { AccommodationDraftApiPort } from "../ports/accommodationDraftApiPort";
import { useCreateAccommodationDraft } from "./useCreateAccommodationDraft";

const createApi = (): jest.Mocked<AccommodationDraftApiPort> => ({
  create: jest.fn(),
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe("useCreateAccommodationDraft", () => {
  it("creates a host draft and returns its id to the caller", async () => {
    const api = createApi();
    const onCreated = jest.fn();
    const onError = jest.fn();
    api.create.mockResolvedValue({ id: 88 });

    const { result } = renderHook(() =>
      useCreateAccommodationDraft({
        api,
        onCreated,
        onError,
      })
    );

    await act(async () => {
      await result.current.createDraft();
    });

    await waitFor(() => expect(result.current.isCreating).toBe(false));

    expect(api.create).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledWith(88);
    expect(onError).not.toHaveBeenCalled();
  });

  it("returns an AppError to the caller without leaving creation pending", async () => {
    const api = createApi();
    const error = new AppError({
      kind: "server",
      code: "DRAFT_CREATE_FAILED",
      message: "The draft could not be created.",
      retryable: true,
    });
    const onCreated = jest.fn();
    const onError = jest.fn();
    api.create.mockRejectedValue(error);

    const { result } = renderHook(() =>
      useCreateAccommodationDraft({ api, onCreated, onError }),
    );

    await act(async () => {
      await result.current.createDraft();
    });

    await waitFor(() => expect(result.current.isCreating).toBe(false));
    expect(onError).toHaveBeenCalledWith(error);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("publishes a successful draft after the StrictMode effect replay", async () => {
    const api = createApi();
    const onCreated = jest.fn();
    const onError = jest.fn();
    api.create.mockResolvedValue({ id: 88 });

    const { result } = renderHook(
      () => useCreateAccommodationDraft({ api, onCreated, onError }),
      { reactStrictMode: true },
    );

    await act(async () => {
      await result.current.createDraft();
    });

    await waitFor(() => expect(result.current.isCreating).toBe(false));
    expect(onCreated).toHaveBeenCalledWith(88);
    expect(onError).not.toHaveBeenCalled();
  });

  it("publishes a failed draft after the StrictMode effect replay", async () => {
    const api = createApi();
    const error = new AppError({
      kind: "server",
      code: "DRAFT_CREATE_FAILED",
      message: "The draft could not be created.",
      retryable: true,
    });
    const onCreated = jest.fn();
    const onError = jest.fn();
    api.create.mockRejectedValue(error);

    const { result } = renderHook(
      () => useCreateAccommodationDraft({ api, onCreated, onError }),
      { reactStrictMode: true },
    );

    await act(async () => {
      await result.current.createDraft();
    });

    await waitFor(() => expect(result.current.isCreating).toBe(false));
    expect(onError).toHaveBeenCalledWith(error);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("coalesces rapid calls into the exact active draft Promise", async () => {
    const api = createApi();
    const pending = deferred<{ id: number }>();
    api.create.mockReturnValue(pending.promise);
    const { result } = renderHook(() =>
      useCreateAccommodationDraft({
        api,
        onCreated: jest.fn(),
        onError: jest.fn(),
      }),
    );

    let first!: Promise<void>;
    let duplicate!: Promise<void>;
    act(() => {
      first = result.current.createDraft();
      duplicate = result.current.createDraft();
    });

    expect(duplicate).toBe(first);
    expect(api.create).not.toHaveBeenCalled();
    await act(async () => {
      await Promise.resolve();
    });
    expect(api.create).toHaveBeenCalledTimes(1);

    pending.resolve({ id: 88 });
    await act(async () => {
      await first;
    });
  });

  it("does not publish a late result after its owner unmounts", async () => {
    const api = createApi();
    const pending = deferred<{ id: number }>();
    const onCreated = jest.fn();
    const onError = jest.fn();
    api.create.mockReturnValue(pending.promise);
    const view = renderHook(() =>
      useCreateAccommodationDraft({ api, onCreated, onError }),
    );

    let operation!: Promise<void>;
    act(() => {
      operation = view.result.current.createDraft();
    });
    view.unmount();
    pending.resolve({ id: 88 });
    await operation;

    expect(onCreated).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
