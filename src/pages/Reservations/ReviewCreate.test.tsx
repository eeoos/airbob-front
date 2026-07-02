import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReviewCreate from "./ReviewCreate";

const mockNavigate = jest.fn();
const mockSubmitReview = jest.fn();
const mockClearError = jest.fn();
const mockHandleError = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ reservationUid: "reservation-123" }),
}), { virtual: true });

jest.mock("../../features/reviews", () => ({
  REVIEW_IMAGE_UPLOAD_ERROR_MESSAGE:
    "리뷰는 작성되었지만 이미지 업로드에 실패했습니다.",
  useReviewCreate: () => ({
    clearError: mockClearError,
    error: null,
    handleError: mockHandleError,
    isLoading: false,
    isSubmitting: false,
    reservation: {
      reservation_uid: "reservation-123",
      reservation_code: "CODE-123",
      status: "CONFIRMED",
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
    },
    submitReview: mockSubmitReview,
  }),
}));

jest.mock("../../components/ErrorToast", () => ({
  ErrorToast: ({ message }: { message: string }) => (
    <div role="alert">{message}</div>
  ),
}));

describe("ReviewCreate", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSubmitReview.mockReset();
    mockClearError.mockReset();
    mockHandleError.mockReset();
  });

  it("passes upload failure feedback to the reservation detail page", async () => {
    mockSubmitReview.mockResolvedValue({
      status: "upload_failed",
      reservationUid: "reservation-123",
    });

    render(<ReviewCreate />);

    await userEvent.type(screen.getByLabelText("리뷰 내용"), "좋은 숙소였어요.");
    await userEvent.click(screen.getByRole("button", { name: "리뷰 작성하기" }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123",
        {
          state: {
            toastMessage: "리뷰는 작성되었지만 이미지 업로드에 실패했습니다.",
          },
        }
      )
    );
  });
});
