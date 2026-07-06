import { fireEvent, render, screen } from "@testing-library/react";
import { ReviewInfo } from "../../../types/review";
import { toReviewViewModel } from "../../reviews/lib/reviewViewModel";
import { AccommodationReviewsSection } from "./AccommodationReviewsSection";

jest.mock("../../../utils/image", () => ({
  getImageUrl: (url: string) => url,
}));

const review: ReviewInfo = {
  id: 11,
  rating: 4,
  content: "정말 좋은 숙소였습니다. 다음에도 다시 머물고 싶은 공간입니다.",
  reviewed_at: "2026-07-01T00:00:00",
  reviewer: {
    id: 2,
    nickname: "게스트",
    thumbnail_image_url: "/guest.jpg",
  },
  images: [{ id: 3, image_url: "/review.jpg" }],
};

const setupReviews = (
  overrides: Partial<
    React.ComponentProps<typeof AccommodationReviewsSection>
  > = {}
) => {
  const props: React.ComponentProps<typeof AccommodationReviewsSection> = {
    reviewSummary: {
      averageRating: 4.75,
      reviewCount: 7,
      hasReviews: true,
      averageRatingLabel: "4.8",
      reviewCountLabel: "(7)",
    },
    reviews: [toReviewViewModel(review)],
    expandedReviews: {},
    onOpenReviews: jest.fn(),
    ...overrides,
  };

  render(<AccommodationReviewsSection {...props} />);

  return props;
};

describe("AccommodationReviewsSection", () => {
  it("renders review summary, reviewer, rating date, content, images, and view-all action", () => {
    const reviewsProps = setupReviews();

    expect(
      screen.getByRole("heading", { name: "★ 4.75 · 후기 7개" })
    ).toBeInTheDocument();
    expect(screen.getByAltText("게스트")).toHaveAttribute("src", "/guest.jpg");
    expect(screen.getByText("게스트")).toBeInTheDocument();
    expect(screen.getByText("2026년 7월")).toBeInTheDocument();
    expect(screen.getByText(review.content)).toBeInTheDocument();
    expect(screen.getByAltText("리뷰 이미지")).toHaveAttribute(
      "src",
      "/review.jpg"
    );

    fireEvent.click(screen.getByRole("button", { name: "후기 7개 모두 보기" }));

    expect(reviewsProps.onOpenReviews).toHaveBeenCalledTimes(1);
  });

  it("opens all reviews from a truncated review", () => {
    const onOpenReviews = jest.fn();
    setupReviews({
      maxReviewContentLength: 5,
      onOpenReviews,
    });

    expect(screen.getByText("정말 좋은...")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "더보기" }));

    expect(onOpenReviews).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when there are no reviews", () => {
    const { container } = render(
      <AccommodationReviewsSection
        reviewSummary={{
          averageRating: 0,
          reviewCount: 0,
          hasReviews: false,
          averageRatingLabel: "0.0",
          reviewCountLabel: "(0)",
        }}
        reviews={[]}
        expandedReviews={{}}
        onOpenReviews={jest.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
