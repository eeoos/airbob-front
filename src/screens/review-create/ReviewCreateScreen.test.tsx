import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "../../test/renderApp";
import { ReviewCreateScreen, type ReviewCreateScreenProps } from "./ReviewCreateScreen";

const createProps = (): ReviewCreateScreenProps => ({
  comment: "좋은 숙소였어요.",
  errorMessage: null,
  images: [],
  isSubmitting: false,
  isSubmitLocked: false,
  onBack: jest.fn(),
  onCancel: jest.fn(),
  onClearError: jest.fn(),
  onCommentChange: jest.fn(),
  onImagesSelected: jest.fn(),
  onRatingChange: jest.fn(),
  onRemoveImage: jest.fn(),
  onSubmit: jest.fn(),
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
  it("renders loading and backend error terminals without domain actions", () => {
    const { rerender } = renderApp(
      <ReviewCreateScreen {...createProps()} state={{ status: "loading" }} />,
    );
    expect(screen.getByText("로딩 중...")).toBeInTheDocument();

    rerender(
      <ReviewCreateScreen
        {...createProps()}
        state={{
          status: "error",
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

    await userEvent.click(screen.getByRole("button", { name: "4점" }));
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
});
