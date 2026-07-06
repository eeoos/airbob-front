import { ReviewSortType } from "../../types/enums";
import { accommodationQueryKeys } from "./queryKeys";

describe("accommodationQueryKeys", () => {
  it("builds review keys under the accommodation query root", () => {
    expect(accommodationQueryKeys.reviewsRoot(12)).toEqual([
      "accommodation",
      "reviews",
      "12",
    ]);

    expect(
      accommodationQueryKeys.reviews({
        accommodationId: 12,
        cursor: "cursor-1",
        size: 6,
        sortType: ReviewSortType.LATEST,
      }),
    ).toEqual([
      "accommodation",
      "reviews",
      "12",
      ReviewSortType.LATEST,
      6,
      "cursor-1",
    ]);
  });

  it("normalizes numeric and string review accommodation ids to the same key", () => {
    expect(accommodationQueryKeys.reviewsRoot(12)).toEqual(
      accommodationQueryKeys.reviewsRoot("12"),
    );
  });

  it("uses stable missing and first-page sentinels", () => {
    expect(
      accommodationQueryKeys.reviews({
        accommodationId: null,
        cursor: null,
        size: 6,
        sortType: ReviewSortType.LATEST,
      }),
    ).toEqual([
      "accommodation",
      "reviews",
      "missing",
      ReviewSortType.LATEST,
      6,
      "first",
    ]);
  });
});
