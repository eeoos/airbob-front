import { renderHook, waitFor } from "@testing-library/react";
import { accommodationApi } from "../../../../api";
import { useAccommodationEditDetail } from "./useAccommodationEditDetail";

jest.mock("../../../../api", () => ({
  accommodationApi: {
    getHostAccommodationDetail: jest.fn(),
  },
}));

const hostAccommodation = {
  id: 3,
  images: [{ id: 11, image_url: "/room.jpg" }],
} as any;

describe("useAccommodationEditDetail", () => {
  beforeEach(() => {
    jest.mocked(accommodationApi.getHostAccommodationDetail).mockReset();
  });

  it("loads existing host detail in edit mode", async () => {
    const loadAccommodation = jest.fn();
    const loadImages = jest.fn();
    const handleError = jest.fn();
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValue(hostAccommodation);

    renderHook(() =>
      useAccommodationEditDetail({
        accommodationId: "3",
        isNewDraft: false,
        loadAccommodation,
        loadImages,
        handleError,
      })
    );

    await waitFor(() =>
      expect(accommodationApi.getHostAccommodationDetail).toHaveBeenCalledWith(3)
    );
    expect(loadAccommodation).toHaveBeenCalledWith(hostAccommodation);
    expect(loadImages).toHaveBeenCalledWith(hostAccommodation.images);
    expect(handleError).not.toHaveBeenCalled();
  });

  it("skips loading for newly created drafts", () => {
    renderHook(() =>
      useAccommodationEditDetail({
        accommodationId: "3",
        isNewDraft: true,
        loadAccommodation: jest.fn(),
        loadImages: jest.fn(),
        handleError: jest.fn(),
      })
    );

    expect(accommodationApi.getHostAccommodationDetail).not.toHaveBeenCalled();
  });
});
