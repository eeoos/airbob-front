import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { reservationApi, reviewApi } from "../../../api";
import { accommodationQueryKeys } from "../../accommodations/queryKeys";
import { reservationQueryKeys } from "../../reservations/queryKeys";
import { ReservationStatus } from "../../../types/enums";
import { ReservationDetailInfo } from "../../../types/reservation";
import { UploadReviewImagesData } from "../../../types/review";
import { useReviewCreate } from "./useReviewCreate";

const mockClearError = jest.fn();
const mockHandleError = jest.fn((error: unknown) =>
  error instanceof Error ? error.message : "error"
);

jest.mock("../../../api", () => ({
  reservationApi: {
    getMyReservationDetail: jest.fn(),
  },
  reviewApi: {
    create: jest.fn(),
    uploadImages: jest.fn(),
  },
}));

jest.mock("../../../hooks/useApiError", () => ({
  useApiError: () => ({
    error: null,
    clearError: mockClearError,
    handleError: mockHandleError,
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { queryClient, wrapper };
};

const createReservationDetail = (
  reservationUid = "reservation-1"
): ReservationDetailInfo => ({
    reservation_uid: reservationUid,
    reservation_code: "CODE-1",
    status: ReservationStatus.CONFIRMED,
    created_at: "2026-07-01T00:00:00",
    guest_count: 2,
    check_in_date_time: "2026-07-10T15:00:00",
    check_out_date_time: "2026-07-12T11:00:00",
    check_in_time: "15:00",
    check_out_time: "11:00",
    can_write_review: true,
    accommodation: {
      id: 7,
      name: "테스트 숙소",
      thumbnail_url: null,
    },
    address: {
      country: "KR",
      state: null,
      city: "Seoul",
      district: "Mapo",
      street: "와우산로",
      detail: null,
      postal_code: "04000",
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
    payment: null,
  });

const uploadReviewImagesData: UploadReviewImagesData = {
  uploaded_images: [],
};

describe("useReviewCreate", () => {
  beforeEach(() => {
    mockClearError.mockReset();
    mockHandleError.mockClear();
    jest.mocked(reservationApi.getMyReservationDetail).mockReset();
    jest.mocked(reviewApi.create).mockReset();
    jest.mocked(reviewApi.uploadImages).mockReset();
  });

  it("loads reservation detail for the review form", async () => {
    const reservation = createReservationDetail("reservation-123");
    jest
      .mocked(reservationApi.getMyReservationDetail)
      .mockResolvedValue(reservation);

    const { result } = renderHook(() => useReviewCreate("reservation-123"), {
      wrapper: createWrapper().wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(reservationApi.getMyReservationDetail).toHaveBeenCalledWith(
      "reservation-123"
    );
    expect(result.current.reservation).toEqual(reservation);
  });

  it("creates a review and uploads selected images", async () => {
    const reservation = createReservationDetail("reservation-123");
    const image = new File(["image"], "review.png", { type: "image/png" });
    jest
      .mocked(reservationApi.getMyReservationDetail)
      .mockResolvedValue(reservation);
    jest.mocked(reviewApi.create).mockResolvedValue({ id: 55 });
    jest.mocked(reviewApi.uploadImages).mockResolvedValue(uploadReviewImagesData);

    const { queryClient, wrapper } = createWrapper();
    const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useReviewCreate("reservation-123"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.reservation).toEqual(reservation));

    let submitResult: Awaited<ReturnType<typeof result.current.submitReview>>;
    await act(async () => {
      submitResult = await result.current.submitReview({
        content: "좋은 숙소였어요.",
        images: [image],
        rating: 5,
      });
    });

    expect(reviewApi.create).toHaveBeenCalledWith(7, {
      rating: 5,
      content: "좋은 숙소였어요.",
    });
    expect(reviewApi.uploadImages).toHaveBeenCalledWith(55, [image]);
    expect(submitResult!).toEqual({
      status: "success",
      reservationUid: "reservation-123",
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: reservationQueryKeys.guestReservationDetail("reservation-123"),
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: reservationQueryKeys.guestReservationsRoot,
    });
    expect(invalidateQueriesSpy).not.toHaveBeenCalledWith({
      queryKey: reservationQueryKeys.all,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: accommodationQueryKeys.reviewsRoot("7"),
    });
    expect(result.current.isSubmitting).toBe(false);
  });

  it("returns an upload failure result after creating the review", async () => {
    const reservation = createReservationDetail("reservation-123");
    const image = new File(["image"], "review.png", { type: "image/png" });
    jest
      .mocked(reservationApi.getMyReservationDetail)
      .mockResolvedValue(reservation);
    jest.mocked(reviewApi.create).mockResolvedValue({ id: 55 });
    jest
      .mocked(reviewApi.uploadImages)
      .mockRejectedValue(new Error("upload failed"));

    const { result } = renderHook(() => useReviewCreate("reservation-123"), {
      wrapper: createWrapper().wrapper,
    });

    await waitFor(() => expect(result.current.reservation).toEqual(reservation));

    let submitResult: Awaited<ReturnType<typeof result.current.submitReview>>;
    await act(async () => {
      submitResult = await result.current.submitReview({
        content: "좋은 숙소였어요.",
        images: [image],
        rating: 5,
      });
    });

    expect(mockHandleError).toHaveBeenCalledWith(
      new Error("리뷰는 작성되었지만 이미지 업로드에 실패했습니다.")
    );
    expect(submitResult!).toEqual({
      status: "upload_failed",
      reservationUid: "reservation-123",
    });
    expect(result.current.isSubmitting).toBe(false);
  });

  it("does not submit when review content is blank", async () => {
    const reservation = createReservationDetail("reservation-123");
    jest
      .mocked(reservationApi.getMyReservationDetail)
      .mockResolvedValue(reservation);

    const { result } = renderHook(() => useReviewCreate("reservation-123"), {
      wrapper: createWrapper().wrapper,
    });

    await waitFor(() => expect(result.current.reservation).toEqual(reservation));

    let submitResult: Awaited<ReturnType<typeof result.current.submitReview>>;
    await act(async () => {
      submitResult = await result.current.submitReview({
        content: "   ",
        images: [],
        rating: 5,
      });
    });

    expect(reviewApi.create).not.toHaveBeenCalled();
    expect(mockHandleError).toHaveBeenCalledWith(
      new Error("리뷰 내용을 입력해주세요.")
    );
    expect(submitResult!).toEqual({ status: "invalid" });
  });
});
