import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "../../test/renderApp";
import {
  ReviewCreateScreen,
  type ReviewCreateScreenProps,
} from "./ReviewCreateScreen";

const createProps = (): ReviewCreateScreenProps => ({
  comment: "좋은 숙소였어요.",
  errorMessage: null,
  images: [],
  isSubmitting: false,
  isSubmitLocked: false,
  onBack: vi.fn(),
  onCancel: vi.fn(),
  onClearError: vi.fn(),
  onCommentChange: vi.fn(),
  onImagesSelected: vi.fn(),
  onRatingChange: vi.fn(),
  onRemoveImage: vi.fn(),
  onRetryLoad: vi.fn(),
  onSubmit: vi.fn(),
  rating: 5,
  state: {
    status: "ready",
    reservation: {
      accommodationName: "테스트 숙소",
      addressLabel: "대한민국 서울 마포구",
      dateLabel: "2026년 7월 10일 - 2026년 7월 12일",
      thumbnailUrl: "https://cdn.example.com/room.jpg",
    },
  },
});

describe("ReviewCreateScreen", () => {
  it("renders a cold skeleton and separates retryable from terminal errors", async () => {
    const props = createProps();
    const { rerender } = renderApp(
      <ReviewCreateScreen {...props} state={{ status: "loading" }} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "리뷰 작성 정보를 불러오는 중입니다.",
    );

    rerender(
      <ReviewCreateScreen
        {...props}
        state={{
          status: "retryable-error",
          message: "네트워크 연결을 확인해주세요.",
        }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(props.onRetryLoad).toHaveBeenCalledTimes(1);

    rerender(
      <ReviewCreateScreen
        {...props}
        state={{
          status: "terminal-error",
          message: "이 예약에 리뷰를 작성할 권한이 없습니다.",
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "이 예약에 리뷰를 작성할 권한이 없습니다.",
    );
    expect(
      screen.queryByRole("button", { name: "리뷰 작성하기" }),
    ).not.toBeInTheDocument();
  });

  it("publishes only props-based form actions", async () => {
    const props = createProps();
    renderApp(<ReviewCreateScreen {...props} />);

    await userEvent.click(screen.getByRole("radio", { name: "4점" }));
    await userEvent.type(screen.getByLabelText("리뷰 내용"), " 더 좋아요");
    await userEvent.click(
      screen.getByRole("button", { name: "리뷰 작성하기" }),
    );

    expect(props.onRatingChange).toHaveBeenCalledWith(4);
    expect(props.onCommentChange).toHaveBeenCalled();
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("passes selected files and clears the native input value", async () => {
    const props = createProps();
    const image = new File(["image"], "room.png", { type: "image/png" });
    renderApp(<ReviewCreateScreen {...props} />);

    const input = screen.getByLabelText("사진 선택") as HTMLInputElement;
    await userEvent.upload(input, image);

    expect(props.onImagesSelected).toHaveBeenCalledWith([image]);
    expect(input.value).toBe("");
  });

  it("links field help, disables form inputs while submitting, and exposes the locked next action", () => {
    const { rerender } = renderApp(
      <ReviewCreateScreen {...createProps()} isSubmitting />,
    );

    expect(screen.getByLabelText("리뷰 내용")).toBeDisabled();
    expect(screen.getByLabelText("사진 선택")).toBeDisabled();
    expect(screen.getByRole("radio", { name: "5점" })).toBeDisabled();
    expect(screen.getByLabelText("리뷰 내용")).toHaveAttribute(
      "aria-describedby",
      "review-comment-hint review-comment-count",
    );

    rerender(
      <ReviewCreateScreen
        {...createProps()}
        isSubmitLocked
        errorMessage="제출 결과를 확인할 수 없습니다."
      />,
    );

    expect(screen.getByText("제출 결과 확인이 필요해요")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "예약 상세에서 확인하기" }),
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "리뷰 작성하기" }),
    ).not.toBeInTheDocument();
  });

  it("replaces failed accommodation and selected-photo media", () => {
    renderApp(
      <ReviewCreateScreen
        {...createProps()}
        images={[{ id: "image-1", previewUrl: "blob:failed" }]}
      />,
    );

    const accommodationImage = screen.getByAltText("테스트 숙소");
    const previewImage = screen.getByAltText("선택한 사진 1");
    fireEvent.error(accommodationImage);
    fireEvent.error(previewImage);

    expect(
      screen.getByRole("img", { name: "테스트 숙소 숙소 이미지 없음" }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: "선택한 사진 1 미리보기 없음" }),
    ).toBeVisible();
  });
});
