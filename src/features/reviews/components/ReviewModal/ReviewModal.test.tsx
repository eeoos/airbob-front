import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewInfo } from "../../../../types/review";
import { toReviewViewModels } from "../../lib/reviewViewModel";
import { ReviewModal } from "./ReviewModal";

jest.mock("../../../../utils/image", () => ({
  getImageUrl: (url: string) => url,
}));

const reviews: ReviewInfo[] = [
  {
    id: 1,
    rating: 5,
    content: "가장 좋은 후기",
    reviewed_at: "2026-07-03T10:00:00Z",
    reviewer: {
      id: 10,
      nickname: "민수",
      thumbnail_image_url: "/minsu.jpg",
    },
    images: [],
  },
  {
    id: 2,
    rating: 1,
    content: "낮은 평점 후기",
    reviewed_at: "2026-07-01T10:00:00Z",
    reviewer: {
      id: 11,
      nickname: "지영",
      thumbnail_image_url: null,
    },
    images: [],
  },
];

const renderReviewModal = (
  overrides: Partial<React.ComponentProps<typeof ReviewModal>> = {}
) => {
  const props: React.ComponentProps<typeof ReviewModal> = {
    averageRating: 4.25,
    isOpen: true,
    onClose: jest.fn(),
    reviews: toReviewViewModels(reviews),
    totalCount: 2,
    ...overrides,
  };

  const view = render(<ReviewModal {...props} />);

  return { props, ...view };
};

const reviewContents = () =>
  screen
    .getAllByText(/후기$/)
    .map((element) => element.textContent);

describe("ReviewModal", () => {
  it("renders as a Dialog with review summary content", () => {
    renderReviewModal();

    expect(screen.getByRole("dialog", { name: "후기 2개" })).toBeInTheDocument();
    expect(screen.getByText("★ 4.25")).toBeInTheDocument();
    expect(screen.getByText("후기 2개")).toBeInTheDocument();
    expect(screen.getByText("가장 좋은 후기")).toBeInTheDocument();
    expect(screen.getByText("낮은 평점 후기")).toBeInTheDocument();
  });

  it("closes from explicit close control, Escape, and backdrop", async () => {
    const { props } = renderReviewModal();

    await userEvent.click(screen.getByRole("button", { name: "후기 모달 닫기" }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("presentation"));

    expect(props.onClose).toHaveBeenCalledTimes(3);
  });

  it("sorts reviews from the dropdown", async () => {
    renderReviewModal();

    expect(reviewContents()).toEqual(["가장 좋은 후기", "낮은 평점 후기"]);

    await userEvent.click(screen.getByRole("button", { name: "최신순" }));
    await userEvent.click(screen.getByRole("button", { name: "낮은 평점순" }));

    const dialog = screen.getByRole("dialog", { name: "후기 2개" });
    expect(
      within(dialog)
        .getAllByText(/후기$/)
        .map((element) => element.textContent)
    ).toEqual(["낮은 평점 후기", "가장 좋은 후기"]);
  });

  it("renders nothing while closed", () => {
    const { container } = renderReviewModal({ isOpen: false });

    expect(container).toBeEmptyDOMElement();
  });
});
