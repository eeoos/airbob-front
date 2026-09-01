import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";
import { testSessionRuntimeLeaseId } from "../../../test/sessionFixtures";
import { wishlistReadQueryKeys } from "./queryKeys";

const scope = {
  subject: "subject:member_7",
  epoch: 4,
  runtimeLeaseId: testSessionRuntimeLeaseId,
} as AuthenticatedSessionScope;

describe("session-scoped wishlist read query keys", () => {
  it("keys collection reads by their semantic accommodation input", () => {
    expect(wishlistReadQueryKeys.lists(scope, null)).toEqual([
      "wishlist",
      "lists",
      null,
      {
        session: {
          subject: "subject:member_7",
          epoch: 4,
        },
      },
    ]);
    expect(wishlistReadQueryKeys.lists(scope, 31)).toEqual([
      "wishlist",
      "lists",
      31,
      {
        session: {
          subject: "subject:member_7",
          epoch: 4,
        },
      },
    ]);
  });

  it("fences detail and recently-viewed reads by the same subject and epoch", () => {
    expect(wishlistReadQueryKeys.detail(scope, 7)).toEqual([
      "wishlist",
      "detail",
      7,
      {
        session: {
          subject: "subject:member_7",
          epoch: 4,
        },
      },
    ]);
    expect(wishlistReadQueryKeys.recentlyViewed(scope)).toEqual([
      "wishlist",
      "recentlyViewed",
      {
        session: {
          subject: "subject:member_7",
          epoch: 4,
        },
      },
    ]);
  });
});
