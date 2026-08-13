import { act, renderHook, waitFor } from "@testing-library/react";
import { accommodationApi } from "../../../../api";
import { HostAccommodationDetail } from "../../../../types/accommodation";
import { useAccommodationEditDetail } from "./useAccommodationEditDetail";

jest.mock("../../../../api", () => ({
  accommodationApi: {
    getHostAccommodationDetail: jest.fn(),
  },
}));

const hostAccommodation: HostAccommodationDetail = {
  id: 3,
  name: "테스트 숙소",
  description: "설명",
  type: "ENTIRE_PLACE",
  base_price: 100000,
  currency: "KRW",
  check_in_time: "15:00:00",
  check_out_time: "11:00:00",
  address: {
    country: "KR",
    state: null,
    city: "Seoul",
    district: null,
    street: "테스트로",
    detail: null,
    postal_code: "12345",
  },
  coordinate: {
    latitude: 37.5,
    longitude: 127,
  },
  host: {
    id: 1,
    nickname: "호스트",
    thumbnail_image_url: null,
  },
  policy: {
    max_occupancy: 4,
    infant_occupancy: 1,
    pet_occupancy: 1,
  },
  amenities: [],
  images: [{ id: 11, image_url: "/room.jpg" }],
  review_summary: {
    total_count: 0,
    average_rating: 0,
  },
};

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
        loadAccommodation,
        loadImages,
        handleError,
      })
    );

    await waitFor(() =>
      expect(accommodationApi.getHostAccommodationDetail).toHaveBeenCalledWith(3)
    );
    expect(loadAccommodation).toHaveBeenCalledWith("3", hostAccommodation);
    expect(loadImages).toHaveBeenCalledWith(hostAccommodation.images);
    expect(handleError).not.toHaveBeenCalled();
  });

  it("loads persisted host detail after a draft was newly created", async () => {
    const loadAccommodation = jest.fn();
    const loadImages = jest.fn();
    const handleError = jest.fn();
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValue(hostAccommodation);

    renderHook(() =>
      useAccommodationEditDetail({
        accommodationId: "3",
        loadAccommodation,
        loadImages,
        handleError,
      })
    );

    await waitFor(() =>
      expect(accommodationApi.getHostAccommodationDetail).toHaveBeenCalledWith(3)
    );
    expect(loadAccommodation).toHaveBeenCalledWith("3", hostAccommodation);
    expect(loadImages).toHaveBeenCalledWith(hostAccommodation.images);
    expect(handleError).not.toHaveBeenCalled();
  });

  it("keeps the editor initializing until host detail settles", async () => {
    const loadAccommodation = jest.fn();
    const loadImages = jest.fn();
    const handleError = jest.fn();
    let resolveDetail: (detail: HostAccommodationDetail) => void = () => undefined;
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDetail = resolve;
          })
      );

    const { result } = renderHook(() =>
      useAccommodationEditDetail({
        accommodationId: "3",
        loadAccommodation,
        loadImages,
        handleError,
      })
    );

    expect(result.current.detailState).toEqual({
      status: "loading",
      accommodationId: "3",
    });

    await act(async () => {
      resolveDetail(hostAccommodation);
    });

    await waitFor(() =>
      expect(result.current.detailState).toEqual({
        status: "ready",
        accommodationId: "3",
      })
    );
    expect(loadAccommodation).toHaveBeenCalledWith("3", hostAccommodation);
  });

  it("keeps a failed detail load in an explicit error state and retries safely", async () => {
    const loadAccommodation = jest.fn();
    const loadImages = jest.fn();
    const handleError = jest.fn();
    const detailError = new Error("detail failed");
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockRejectedValueOnce(detailError)
      .mockResolvedValueOnce(hostAccommodation);

    const { result } = renderHook(() =>
      useAccommodationEditDetail({
        accommodationId: "3",
        loadAccommodation,
        loadImages,
        handleError,
      })
    );

    await waitFor(() =>
      expect(result.current.detailState).toEqual({
        status: "error",
        accommodationId: "3",
      })
    );
    expect(loadAccommodation).not.toHaveBeenCalled();
    expect(handleError).toHaveBeenCalledWith(detailError);

    act(() => {
      result.current.retry();
    });

    expect(result.current.detailState).toEqual({
      status: "loading",
      accommodationId: "3",
    });
    await waitFor(() =>
      expect(result.current.detailState).toEqual({
        status: "ready",
        accommodationId: "3",
      })
    );
    expect(loadAccommodation).toHaveBeenCalledWith("3", hostAccommodation);
    expect(accommodationApi.getHostAccommodationDetail).toHaveBeenCalledTimes(2);
  });

  it("ignores an old response after the route accommodation changes", async () => {
    const loadAccommodation = jest.fn();
    const loadImages = jest.fn();
    const handleError = jest.fn();
    const resolvers = new Map<
      number,
      (detail: HostAccommodationDetail) => void
    >();
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockImplementation(
        (accommodationId) =>
          new Promise((resolve) => {
            resolvers.set(accommodationId, resolve);
          })
      );

    const { result, rerender } = renderHook(
      ({ accommodationId }) =>
        useAccommodationEditDetail({
          accommodationId,
          loadAccommodation,
          loadImages,
          handleError,
        }),
      { initialProps: { accommodationId: "3" } }
    );

    rerender({ accommodationId: "4" });
    expect(result.current.detailState).toEqual({
      status: "loading",
      accommodationId: "4",
    });

    await act(async () => {
      resolvers.get(3)?.(hostAccommodation);
    });

    expect(loadAccommodation).not.toHaveBeenCalled();
    expect(result.current.detailState).toEqual({
      status: "loading",
      accommodationId: "4",
    });

    const nextAccommodation = {
      ...hostAccommodation,
      id: 4,
      name: "새 경로 숙소",
    };
    await act(async () => {
      resolvers.get(4)?.(nextAccommodation);
    });

    await waitFor(() =>
      expect(result.current.detailState).toEqual({
        status: "ready",
        accommodationId: "4",
      })
    );
    expect(loadAccommodation).toHaveBeenCalledTimes(1);
    expect(loadAccommodation).toHaveBeenCalledWith("4", nextAccommodation);
  });

  it("rejects a successful response for a different accommodation", async () => {
    const loadAccommodation = jest.fn();
    const loadImages = jest.fn();
    const handleError = jest.fn();
    jest
      .mocked(accommodationApi.getHostAccommodationDetail)
      .mockResolvedValue({ ...hostAccommodation, id: 4 });

    const { result } = renderHook(() =>
      useAccommodationEditDetail({
        accommodationId: "3",
        loadAccommodation,
        loadImages,
        handleError,
      })
    );

    await waitFor(() =>
      expect(result.current.detailState).toEqual({
        status: "error",
        accommodationId: "3",
      })
    );

    expect(loadAccommodation).not.toHaveBeenCalled();
    expect(loadImages).not.toHaveBeenCalled();
    expect(handleError).toHaveBeenCalledWith(expect.any(Error));
  });
});
