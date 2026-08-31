import { apiFailure, apiSuccess, requireApiRequest } from "../fixtures/api";
import { test, expect } from "../fixtures/test";

const REVIEW_RESERVATION_UID = "10000000-0000-4000-8000-000000000001";

const requireSerializedRequestBody = (body: unknown): string => {
  if (typeof body !== "string") {
    throw new Error("Review upload request body must be serialized text.");
  }

  return body;
};

const reviewableReservation = {
  reservation_uid: REVIEW_RESERVATION_UID,
  reservation_code: "REVIEW-2026",
  status: "CONFIRMED",
  payment_allowed: false,
  hold_expires_at: null,
  server_time: "2026-09-01T00:00:00Z",
  created_at: "2026-06-01T00:00:00Z",
  guest_count: 2,
  check_in_date_time: "2026-06-10T15:00:00",
  check_out_date_time: "2026-06-12T11:00:00",
  time_zone_id: "Asia/Seoul",
  check_in_time: "15:00",
  check_out_time: "11:00",
  request_message: null,
  can_write_review: true,
  accommodation: {
    id: 7,
    name: "합정 테스트 숙소",
    thumbnail_url: null,
  },
  address: {
    country: "대한민국",
    state: "서울특별시",
    city: "서울",
    district: "마포구",
    street: "양화로",
    detail: "101호",
    postal_code: "04000",
  },
  coordinate: {
    latitude: null,
    longitude: null,
  },
  host: {
    id: 202,
    nickname: "합정 호스트",
    thumbnail_image_url: null,
  },
  payment: null,
};

test("ends review creation at the explicit missing-reservation state", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  api.register(
    "GET",
    `/api/v1/profile/guest/reservations/${REVIEW_RESERVATION_UID}`,
    apiFailure(404, "R404", "예약을 찾을 수 없습니다."),
  );

  await page.goto(`/reservations/${REVIEW_RESERVATION_UID}/review`);

  await expect(
    page.getByText("예약을 찾을 수 없습니다.", { exact: true }),
  ).toBeVisible();
  expect(
    api.matching(
      "GET",
      `/api/v1/profile/guest/reservations/${REVIEW_RESERVATION_UID}`,
    ).length,
  ).toBeGreaterThanOrEqual(1);
});

test("keeps the created review and surfaces terminal feedback when its image upload fails", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  api.register(
    "GET",
    `/api/v1/profile/guest/reservations/${REVIEW_RESERVATION_UID}`,
    apiSuccess(reviewableReservation),
  );
  api.register(
    "POST",
    "/api/v1/accommodations/7/reviews",
    apiSuccess({ id: 901 }, 201),
  );
  api.register(
    "POST",
    "/api/v1/reviews/901/images",
    apiFailure(500, "I001", "이미지 업로드 중 오류가 발생했습니다."),
  );

  await page.goto(`/reservations/${REVIEW_RESERVATION_UID}/review`);

  await expect(
    page.getByRole("heading", { name: "리뷰 작성", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("합정 테스트 숙소에 대한 리뷰를 작성해주세요."),
  ).toBeVisible();

  await page.getByRole("button", { name: "4점" }).click();
  await page
    .getByLabel("리뷰 내용")
    .fill("청결하고 조용해서 다시 머물고 싶은 숙소였습니다.");
  await page.locator('input[type="file"]').setInputFiles({
    name: "stay-review.png",
    mimeType: "image/png",
    buffer: Buffer.from("synthetic-review-image"),
  });
  await expect(page.getByAltText("미리보기 1")).toBeVisible();

  await page.getByRole("button", { name: "리뷰 작성하기" }).click();

  await expect(page).toHaveURL(
    new RegExp(`/reservations/${REVIEW_RESERVATION_UID}$`),
  );
  await expect(page.getByRole("alert")).toHaveText(
    "리뷰는 작성되었지만 이미지 업로드에 실패했습니다.",
  );

  const createRequests = api.matching(
    "POST",
    "/api/v1/accommodations/7/reviews",
  );
  const uploadRequests = api.matching("POST", "/api/v1/reviews/901/images");

  expect(createRequests).toHaveLength(1);
  expect(uploadRequests).toHaveLength(1);
  const createRequest = requireApiRequest(createRequests, 0, "review create");
  const uploadRequest = requireApiRequest(uploadRequests, 0, "review upload");

  expect(createRequest.body).toEqual({
    rating: 4,
    content: "청결하고 조용해서 다시 머물고 싶은 숙소였습니다.",
  });
  expect(uploadRequest.body).toEqual(expect.any(String));
  const serializedUploadBody = requireSerializedRequestBody(uploadRequest.body);
  expect(serializedUploadBody).toContain('name="images"');
  expect(serializedUploadBody).toContain('filename="stay-review.png"');
  expect(serializedUploadBody).toContain("synthetic-review-image");
  expect(createRequest.sequence).toBeLessThan(uploadRequest.sequence);

  await page.getByRole("button", { name: "오류 닫기" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("locks review submission when the create outcome may already have committed", async ({
  api,
  page,
  session,
}) => {
  session.authenticate();
  api.register(
    "GET",
    `/api/v1/profile/guest/reservations/${REVIEW_RESERVATION_UID}`,
    apiSuccess(reviewableReservation),
  );
  api.register(
    "POST",
    "/api/v1/accommodations/7/reviews",
    apiFailure(500, "I001", "리뷰 처리 결과를 확인할 수 없습니다."),
  );

  await page.goto(`/reservations/${REVIEW_RESERVATION_UID}/review`);
  await page.getByLabel("리뷰 내용").fill("결과 확인이 필요한 리뷰입니다.");
  await page.getByRole("button", { name: "리뷰 작성하기" }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "리뷰 처리 결과를 확인할 수 없습니다. 예약 상세에서 리뷰 작성 가능 여부를 확인해주세요.",
  );
  await expect(
    page.getByRole("button", { name: "예약 상세에서 결과 확인" }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "취소" })).toBeEnabled();
  expect(api.matching("POST", "/api/v1/accommodations/7/reviews")).toHaveLength(
    1,
  );
});
