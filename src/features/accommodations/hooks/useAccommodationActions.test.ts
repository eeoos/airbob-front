import { act, renderHook, waitFor } from "@testing-library/react";
import { AppError } from "../../../platform/http/errors";
import { hostListingActionsApi } from "../api/hostListingActionsApi";
import { useAccommodationActions } from "./useAccommodationActions";

const mockClearError = jest.fn();
const mockHandleError = jest.fn();

jest.mock("../api/hostListingActionsApi", () => ({
  hostListingActionsApi: {
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
    jest.mocked(hostListingActionsApi.delete).mockReset();
    jest.mocked(hostListingActionsApi.publish).mockReset();
    jest.mocked(hostListingActionsApi.unpublish).mockReset();
  });

  it("publishes and unpublishes accommodations through the feature boundary", async () => {
    jest.mocked(hostListingActionsApi.publish).mockResolvedValue(undefined);
    jest.mocked(hostListingActionsApi.unpublish).mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useAccommodationActions({
        onClose,
        onSuccess,
      })
    );

    await act(async () => {
      await result.current.publishAccommodation(7);
    });

    expect(hostListingActionsApi.publish).toHaveBeenCalledWith(7);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.unpublishAccommodation(7);
    });

    await waitFor(() => expect(result.current.isProcessing).toBe(false));

    expect(hostListingActionsApi.unpublish).toHaveBeenCalledWith(7);
    expect(onSuccess).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("passes a typed publish failure to the existing error boundary", async () => {
    const publishError = new AppError({
      kind: "validation",
      code: "A003",
      message: "The request could not be validated.",
      status: 422,
    });
    jest.mocked(hostListingActionsApi.publish).mockRejectedValue(publishError);
    const { result } = renderHook(() =>
      useAccommodationActions({
        onClose,
        onSuccess,
      }),
    );

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.publishAccommodation(7);
    });

    expect(outcome).toBe(false);
    expect(mockHandleError).toHaveBeenCalledWith(publishError);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("only deletes after confirmation", async () => {
    const confirmDelete = jest.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    jest.mocked(hostListingActionsApi.delete).mockResolvedValue(undefined);

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

    expect(hostListingActionsApi.delete).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.deleteAccommodation(7);
    });

    expect(confirmDelete).toHaveBeenCalledWith(
      "정말 이 리스팅을 삭제하시겠습니까?"
    );
    expect(hostListingActionsApi.delete).toHaveBeenCalledWith(7);
    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
