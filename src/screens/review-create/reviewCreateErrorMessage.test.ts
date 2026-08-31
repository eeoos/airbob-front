import { toReviewCreateErrorMessage } from "./reviewCreateErrorMessage";

describe("toReviewCreateErrorMessage", () => {
  it.each([
    ["V003", "리뷰를 작성할 권한이 없습니다."],
    ["V004", "이미 리뷰를 작성했습니다."],
    ["R001", "존재하지 않는 예약입니다."],
    ["R008", "해당 예약에 대한 접근 권한이 없습니다."],
    ["M004", "로그인이 필요합니다."],
  ])("maps backend code %s to owned copy", (code, message) => {
    expect(toReviewCreateErrorMessage({ code })).toBe(message);
  });

  it("maps transport failures without exposing raw technical copy", () => {
    expect(toReviewCreateErrorMessage({ kind: "network" })).toBe(
      "네트워크 연결을 확인한 뒤 다시 시도해주세요.",
    );
    expect(toReviewCreateErrorMessage(new Error("internal details"))).toBe(
      "리뷰 요청을 처리하지 못했습니다.",
    );
  });
});
