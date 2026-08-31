import type { AuthenticatedSessionScope } from "../../../../platform/session/sessionScope";
import type { SessionQueryScope } from "../../../../platform/query/sessionScope";
import { accommodationReadQueryKeys } from "./queryKeys";

const authenticatedScope = {
  subject: "subject:member_7",
  epoch: 4,
} as AuthenticatedSessionScope;

describe("accommodation read query keys", () => {
  it("scopes viewer-dependent detail reads for anonymous and authenticated viewers", () => {
    const anonymousScope: SessionQueryScope = { subject: null, epoch: 3 };

    expect(accommodationReadQueryKeys.detail(anonymousScope, 31)).toEqual([
      "accommodation",
      "detail",
      31,
      { session: { subject: null, epoch: 3 } },
    ]);
    expect(accommodationReadQueryKeys.detail(authenticatedScope, 31)).toEqual([
      "accommodation",
      "detail",
      31,
      {
        session: {
          subject: authenticatedScope.subject,
          epoch: authenticatedScope.epoch,
        },
      },
    ]);
  });

  it("changes detail identity when the subject or epoch changes", () => {
    const base = accommodationReadQueryKeys.detail(authenticatedScope, 31);
    const nextEpoch = accommodationReadQueryKeys.detail(
      { ...authenticatedScope, epoch: 5 },
      31,
    );
    const nextSubject = accommodationReadQueryKeys.detail(
      {
        ...authenticatedScope,
        subject: "subject:member_8" as AuthenticatedSessionScope["subject"],
      },
      31,
    );

    expect(base).not.toEqual(nextEpoch);
    expect(base).not.toEqual(nextSubject);
    expect(base).not.toContainEqual(
      expect.objectContaining({ authRefreshIndex: expect.anything() }),
    );
  });

  it("scopes authenticated coupon reads", () => {
    expect(accommodationReadQueryKeys.validCoupons(authenticatedScope)).toEqual(
      [
        "accommodation",
        "coupons",
        "valid",
        {
          session: {
            subject: authenticatedScope.subject,
            epoch: authenticatedScope.epoch,
          },
        },
      ],
    );
  });

  it("represents anonymous coupon state without inventing a subject", () => {
    const anonymousScope: SessionQueryScope = { subject: null, epoch: 9 };

    expect(accommodationReadQueryKeys.validCoupons(anonymousScope)).toEqual([
      "accommodation",
      "coupons",
      "valid",
      { session: { subject: null, epoch: 9 } },
    ]);
  });
});
