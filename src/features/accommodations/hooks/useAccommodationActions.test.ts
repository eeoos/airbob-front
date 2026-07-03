import { act, renderHook, waitFor } from "@testing-library/react";
import { accommodationApi } from "../../../api/accommodations";
import { useAccommodationActions } from "./useAccommodationActions";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();

jest.mock("../../../api/accommodations", () => ({
  accommodationApi: {
    delete: jest.fn(),
    publish: jest.fn(),
    unpublish: jest.fn(),
  },
}));

jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({
    error: null,
    clearError: mockClearError,
    handleError: mockHandleError,
  }),
}));

describe("useAccommodationActions", () => {
  const onClose = jest.fn();
  const onSuccess = jest.fn();

  beforeEach(() => {
    mockClearError.mockReset();
    mockHandleError.mockReset();
    onClose.mockReset();
    onSuccess.mockReset();
    jest.mocked(accommodationApi.delete).mockReset();
    jest.mocked(accommodationApi.publish).mockReset();
    jest.mocked(accommodationApi.unpublish).mockReset();
  });

  it("publishes and unpublishes accommodations through the feature boundary", async () => {
    jest.mocked(accommodationApi.publish).mockResolvedValue(undefined);
    jest.mocked(accommodationApi.unpublish).mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useAccommodationActions({
        onClose,
        onSuccess,
      })
    );

    await act(async () => {
      await result.current.publishAccommodation(7);
    });

    expect(accommodationApi.publish).toHaveBeenCalledWith(7);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.unpublishAccommodation(7);
    });

    await waitFor(() => expect(result.current.isProcessing).toBe(false));

    expect(accommodationApi.unpublish).toHaveBeenCalledWith(7);
    expect(onSuccess).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("only deletes after confirmation", async () => {
    const confirmDelete = jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    jest.mocked(accommodationApi.delete).mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useAccommodationActions({
        confirmDelete,
        onClose,
        onSuccess,
      })
    );

    await act(async () => {
      await result.current.deleteAccommodation(7);
    });

    expect(accommodationApi.delete).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.deleteAccommodation(7);
    });

    expect(confirmDelete).toHaveBeenCalledWith(
      "정말 이 리스팅을 삭제하시겠습니까?"
    );
    expect(accommodationApi.delete).toHaveBeenCalledWith(7);
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
