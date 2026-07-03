import { act, renderHook, waitFor } from "@testing-library/react";
import { accommodationApi } from "../../../api";
import { useCreateAccommodationDraft } from "./useCreateAccommodationDraft";

jest.mock("../../../api", () => ({
  accommodationApi: {
    create: jest.fn(),
  },
}));

describe("useCreateAccommodationDraft", () => {
  beforeEach(() => {
    jest.mocked(accommodationApi.create).mockReset();
  });

  it("creates a host draft and returns its id to the caller", async () => {
    const onCreated = jest.fn();
    const onError = jest.fn();
    jest.mocked(accommodationApi.create).mockResolvedValue({ id: 88 });

    const { result } = renderHook(() =>
      useCreateAccommodationDraft({
        onCreated,
        onError,
      })
    );

    await act(async () => {
      await result.current.createDraft();
    });

    await waitFor(() => expect(result.current.isCreating).toBe(false));

    expect(accommodationApi.create).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledWith(88);
    expect(onError).not.toHaveBeenCalled();
  });
});
