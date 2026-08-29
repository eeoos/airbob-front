import type { ApiHarness } from "./api";
import { apiFailure, apiSuccess } from "./api";

export interface SyntheticUser {
  id: number;
  email: `${string}.invalid`;
  nickname: string;
  thumbnail_image_url: string | null;
}

export const SYNTHETIC_USER_A: SyntheticUser = {
  id: 101,
  email: "person-a@example.invalid",
  nickname: "테스트 사용자",
  thumbnail_image_url: null,
};

export const SYNTHETIC_USER_B: SyntheticUser = {
  id: 202,
  email: "person-b@example.invalid",
  nickname: "테스트 사용자 B",
  thumbnail_image_url: null,
};

export const SYNTHETIC_USER = SYNTHETIC_USER_A;

export interface SessionFixture {
  authenticate(user?: SyntheticUser): void;
  clear(): void;
  failNextLogout(): void;
}

export const installSessionFixture = (api: ApiHarness): SessionFixture => {
  let currentUser: SyntheticUser | null = null;
  let shouldFailNextLogout = false;
  const syntheticUsersByEmail = new Map<string, SyntheticUser>(
    [SYNTHETIC_USER_A, SYNTHETIC_USER_B].map((user) => [user.email, user]),
  );

  api.register("GET", "/api/v1/auth/me", () =>
    currentUser
      ? apiSuccess(currentUser)
      : apiFailure(401, "M004", "로그인이 필요합니다."),
  );
  api.register("POST", "/api/v1/auth/login", (request) => {
    const email =
      typeof request.body === "object" &&
      request.body !== null &&
      "email" in request.body
        ? (request.body as { email?: unknown }).email
        : null;
    const password =
      typeof request.body === "object" &&
      request.body !== null &&
      "password" in request.body
        ? (request.body as { password?: unknown }).password
        : null;

    const syntheticUser =
      typeof email === "string" ? syntheticUsersByEmail.get(email) : undefined;

    if (
      syntheticUser === undefined ||
      typeof password !== "string" ||
      !password.startsWith("synthetic-")
    ) {
      return apiFailure(
        400,
        "E2E_SYNTHETIC_IDENTITY_REQUIRED",
        "브라우저 테스트는 synthetic .invalid 자격 증명만 사용할 수 있습니다.",
      );
    }

    currentUser = syntheticUser;
    return apiSuccess(null);
  });
  api.register("POST", "/api/v1/auth/logout", () => {
    if (shouldFailNextLogout) {
      shouldFailNextLogout = false;
      return apiFailure(
        500,
        "E2E_LOGOUT_FAILURE",
        "Synthetic logout failure.",
      );
    }

    currentUser = null;
    return apiSuccess(null);
  });
  api.register("POST", "/api/v1/members", apiSuccess(null, 201));

  return {
    authenticate(user = SYNTHETIC_USER) {
      if (
        !user.email.endsWith(".invalid") ||
        !/(?:synthetic|테스트)/i.test(user.nickname)
      ) {
        throw new Error(
          "E2E session identity must use a .invalid domain and synthetic nickname.",
        );
      }

      currentUser = user;
    },
    clear() {
      currentUser = null;
    },
    failNextLogout() {
      shouldFailNextLogout = true;
    },
  };
};
