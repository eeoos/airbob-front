import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccommodationReviewsSection } from "./AccommodationReviewsSection";

const review = {
  id: 11,
  rating: 4,
  content: "정말 좋은 숙소였습니다. 다음에도 다시 머물고 싶은 공간입니다.",
  author: {
    name: "게스트",
    avatarUrl: "/guest.jpg",
    avatarInitial: "게",
  },
  date: {
    label: "2026년 7월",
  },
  images: [{ id: 3, url: "/review.jpg", alt: "리뷰 이미지" }],
};

const setupReviews = (
  overrides: Partial<
    React.ComponentProps<typeof AccommodationReviewsSection>
  > = {},
) => {
  const props: React.ComponentProps<typeof AccommodationReviewsSection> = {
    errorMessage: null,
    expandedReviews: {},
    isRetrying: false,
    onOpenReviews: vi.fn(),
    onRetry: vi.fn(),
    reviews: [review],
    reviewSummary: {
      averageRating: 4.75,
      reviewCount: 7,
      hasReviews: true,
      averageRatingLabel: "4.8",
      reviewCountLabel: "(7)",
    },
    status: "ready",
    ...overrides,
  };

  render(<AccommodationReviewsSection {...props} />);

  return props;
};

describe("AccommodationReviewsSection", () => {
  it("renders a semantic travel record with resilient media", () => {
    const reviewsProps = setupReviews();

    expect(
      screen.getByRole("heading", { name: "평점 4.75 · 후기 7개" }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("게스트 프로필")).toHaveAttribute(
      "src",
      "/guest.jpg",
    );
    expect(screen.getByRole("img", { name: "5점 만점에 4점" })).toBeVisible();
    expect(screen.getByText("2026년 7월")).toBeInTheDocument();
    expect(screen.getByText(review.content)).toBeInTheDocument();
    expect(screen.getByAltText("리뷰 이미지")).toHaveAttribute(
      "src",
      "/review.jpg",
    );

    fireEvent.error(screen.getByAltText("게스트 프로필"));
    fireEvent.error(screen.getByAltText("리뷰 이미지"));

    expect(
      screen.getByRole("img", { name: "게스트 프로필 이미지 없음" }),
    ).toBeVisible();
    expect(screen.getByRole("img", { name: "후기 이미지 없음" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "후기 7개 모두 보기" }));
    expect(reviewsProps.onOpenReviews).toHaveBeenCalledTimes(1);
  });

  it("opens all reviews from a truncated review", async () => {
    const onOpenReviews = vi.fn();
    setupReviews({ maxReviewContentLength: 5, onOpenReviews });

    expect(screen.getByText("정말 좋은...")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "이 후기 전체 보기" }),
    );

    expect(onOpenReviews).toHaveBeenCalledTimes(1);
  });

  it("renders loading, empty, and retryable feed states", async () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <AccommodationReviewsSection {...setupProps({ status: "loading" })} />,
    );

    expect(
      screen.getByRole("status", { name: "후기 불러오는 중" }),
    ).toBeVisible();

    rerender(
      <AccommodationReviewsSection
        {...setupProps({
          reviewSummary: {
            averageRating: 0,
            reviewCount: 0,
            hasReviews: false,
            averageRatingLabel: "0.0",
            reviewCountLabel: "(0)",
          },
          reviews: [],
          status: "empty",
        })}
      />,
    );
    expect(screen.getByText("첫 여행 기록을 기다리고 있어요")).toBeVisible();

    rerender(
      <AccommodationReviewsSection
        {...setupProps({
          errorMessage: "네트워크 연결을 확인해 주세요.",
          onRetry,
          reviews: [],
          status: "error",
        })}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

const setupProps = (
  overrides: Partial<
    React.ComponentProps<typeof AccommodationReviewsSection>
  > = {},
): React.ComponentProps<typeof AccommodationReviewsSection> => ({
  errorMessage: null,
  expandedReviews: {},
  isRetrying: false,
  onOpenReviews: vi.fn(),
  onRetry: vi.fn(),
  reviews: [review],
  reviewSummary: {
    averageRating: 4.75,
    reviewCount: 7,
    hasReviews: true,
    averageRatingLabel: "4.8",
    reviewCountLabel: "(7)",
  },
  status: "ready",
  ...overrides,
});
