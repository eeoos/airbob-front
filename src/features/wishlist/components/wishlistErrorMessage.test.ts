import { AppError } from "../../../platform/http/errors";
import { toWishlistErrorMessage } from "./wishlistErrorMessage";

describe("toWishlistErrorMessage", () => {
  it("preserves wishlist backend-code messages", () => {
    expect(
      toWishlistErrorMessage(
        new AppError({ kind: "http", code: "W003", message: "hidden" }),
      ),
    ).toBe("존재하지 않는 위시리스트 항목입니다.");
  });

  it("does not expose arbitrary thrown messages", () => {
    expect(toWishlistErrorMessage(new Error("internal details"))).toBe(
      "알 수 없는 오류가 발생했습니다.",
    );
  });
});
