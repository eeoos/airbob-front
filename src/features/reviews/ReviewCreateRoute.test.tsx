import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NavigateFunction } from "react-router-dom";
import { ReservationStatus } from "../../types/enums";
import { ReviewCreateRoute } from "./ReviewCreateRoute";
import type { useReviewCreate } from "./hooks";

const mockNavigate = jest.fn() as jest.MockedFunction<NavigateFunction>;
const mockSubmitReview = jest.fn();
const mockClearError = jest.fn();
const mockHandleError = jest.fn();
const mockReload = jest.fn();
const mockUseReviewCreate = jest.fn<
  ReturnType<typeof useReviewCreate>,
  Parameters<typeof useReviewCreate>
>();

jest.mock("./hooks", () => ({
  REVIEW_IMAGE_UPLOAD_ERROR_MESSAGE:
    "리뷰는 작성되었지만 이미지 업로드에 실패했습니다.",
  useReviewCreate: (reservationUid: string | undefined) =>
    mockUseReviewCreate(reservationUid),
}));

jest.mock("../../components/ErrorToast", () => ({
  ErrorToast: ({ message }: { message: string }) => (
    <div role="alert">{message}</div>
  ),
}));

const createReviewCreateState = (): ReturnType<typeof useReviewCreate> => ({
  clearError: mockClearError,
  error: null,
  handleError: mockHandleError,
  isLoading: false,
  isSubmitting: false,
  reload: mockReload,
  reservation: {
    reservation_uid: "reservation-123",
    reservation_code: "CODE-123",
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
  },
  submitReview: mockSubmitReview,
});

describe("ReviewCreateRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSubmitReview.mockReset();
    mockClearError.mockReset();
    mockHandleError.mockReset();
    mockReload.mockReset();
    mockUseReviewCreate.mockReset();
    mockUseReviewCreate.mockReturnValue(createReviewCreateState());
    URL.createObjectURL = jest.fn(() => "blob:review-image");
    URL.revokeObjectURL = jest.fn();
  });

  it("routes missing reservationUid to profile without replacement history", async () => {
    render(
      <ReviewCreateRoute
        navigate={mockNavigate}
        reservationUid={undefined}
      />,
    );

    expect(mockUseReviewCreate).toHaveBeenCalledWith(undefined);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/profile");
    });
  });

  it("passes upload failure feedback to the reservation detail page", async () => {
    mockSubmitReview.mockResolvedValue({
      status: "upload_failed",
      reservationUid: "reservation-123",
    });

    render(
      <ReviewCreateRoute
        navigate={mockNavigate}
        reservationUid="reservation-123"
      />,
    );

    await userEvent.type(screen.getByLabelText("리뷰 내용"), "좋은 숙소였어요.");
    await userEvent.click(screen.getByRole("button", { name: "리뷰 작성하기" }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        "/reservations/reservation-123",
        {
          state: {
            toastMessage: "리뷰는 작성되었지만 이미지 업로드에 실패했습니다.",
          },
        },
      ),
    );
  });

  it("validates image type and size before adding previews", async () => {
    const oversizedImage = new File(["image"], "large.png", {
      type: "image/png",
    });
    Object.defineProperty(oversizedImage, "size", {
      value: 10 * 1024 * 1024 + 1,
    });
    const textFile = new File(["text"], "note.txt", { type: "text/plain" });

    render(
      <ReviewCreateRoute
        navigate={mockNavigate}
        reservationUid="reservation-123"
      />,
    );

    await userEvent.upload(screen.getByLabelText("사진 선택"), [
      oversizedImage,
      textFile,
    ]);

    expect(mockHandleError).toHaveBeenCalledWith(
      new Error("large.png 파일 크기는 10MB를 초과할 수 없습니다."),
    );
    expect(mockHandleError).toHaveBeenCalledWith(
      new Error("note.txt은(는) 지원하지 않는 이미지 형식입니다."),
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("resets the file input after invalid-only image selections", async () => {
    const oversizedImage = new File(["image"], "large.png", {
      type: "image/png",
    });
    Object.defineProperty(oversizedImage, "size", {
      value: 10 * 1024 * 1024 + 1,
    });
    const textFile = new File(["text"], "note.txt", { type: "text/plain" });

    render(
      <ReviewCreateRoute
        navigate={mockNavigate}
        reservationUid="reservation-123"
      />,
    );

    const input = screen.getByLabelText("사진 선택") as HTMLInputElement;

    await userEvent.upload(input, oversizedImage);

    expect(mockHandleError).toHaveBeenCalledWith(
      new Error("large.png 파일 크기는 10MB를 초과할 수 없습니다."),
    );
    expect(input.value).toBe("");

    await userEvent.upload(input, textFile);

    expect(mockHandleError).toHaveBeenCalledWith(
      new Error("note.txt은(는) 지원하지 않는 이미지 형식입니다."),
    );
    expect(input.value).toBe("");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("revokes preview URLs when selected images are removed", async () => {
    const image = new File(["image"], "review.png", { type: "image/png" });

    render(
      <ReviewCreateRoute
        navigate={mockNavigate}
        reservationUid="reservation-123"
      />,
    );

    await userEvent.upload(screen.getByLabelText("사진 선택"), image);
    expect(screen.getByAltText("미리보기 1")).toHaveAttribute(
      "src",
      "blob:review-image",
    );

    await userEvent.click(screen.getByRole("button", { name: "이미지 삭제" }));

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:review-image");
    expect(screen.queryByAltText("미리보기 1")).not.toBeInTheDocument();
  });

  it("submits selected image files", async () => {
    const image = new File(["image"], "review.png", { type: "image/png" });
    mockSubmitReview.mockResolvedValue({
      status: "success",
      reservationUid: "reservation-123",
    });

    render(
      <ReviewCreateRoute
        navigate={mockNavigate}
        reservationUid="reservation-123"
      />,
    );

    await userEvent.upload(screen.getByLabelText("사진 선택"), image);
    await userEvent.type(screen.getByLabelText("리뷰 내용"), "좋은 숙소였어요.");
    await userEvent.click(screen.getByRole("button", { name: "리뷰 작성하기" }));

    await waitFor(() => {
      expect(mockSubmitReview).toHaveBeenCalledWith({
        content: "좋은 숙소였어요.",
        images: [image],
        rating: 5,
      });
      expect(mockNavigate).toHaveBeenCalledWith("/reservations/reservation-123");
    });
  });
});
