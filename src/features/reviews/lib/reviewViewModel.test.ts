import type { Review } from "../model";
import { toReviewViewModels } from "./reviewViewModel";

vi.mock("../../../platform/assets/imageUrl", () => ({
  resolveImageUrl: (url: string | null) => url ?? "",
}));

describe("review view-model ownership", () => {
  it("maps the feature-owned review model", () => {
    const review: Review = {
      id: 1,
      rating: 5,
      content: "좋은 후기",
      reviewedAt: "2026-07-03T10:00:00Z",
      reviewer: {
        id: 10,
        nickname: "민수",
        thumbnailImageUrl: "/minsu.jpg",
      },
      images: [{ id: 3, imageUrl: "/review.jpg" }],
    };

    expect(toReviewViewModels([review])).toEqual([
      {
        id: 1,
        rating: 5,
        author: {
          id: 10,
          name: "민수",
          avatarUrl: "/minsu.jpg",
          avatarInitial: "민",
        },
        content: "좋은 후기",
        date: {
          iso: "2026-07-03T10:00:00Z",
          label: "2026년 7월",
          timestamp: Date.parse("2026-07-03T10:00:00Z"),
        },
        images: [{ id: 3, url: "/review.jpg", alt: "리뷰 이미지" }],
      },
    ]);
  });
});
