import type { SessionRuntimeLeaseId } from "./runtimeLeaseId";
import {
  isSameAuthenticatedSessionScope,
  type AuthenticatedSessionScope,
  type SessionSubject,
} from "./sessionScope";

const subject = "subject:member_1" as SessionSubject;
const runtimeLeaseId =
  "10000000-0000-4000-8000-000000000001" as SessionRuntimeLeaseId;
const scope: AuthenticatedSessionScope = {
  subject,
  epoch: 4,
  runtimeLeaseId,
};

describe("authenticated session scope", () => {
  it("requires subject, epoch, and runtime authority to match", () => {
    expect(isSameAuthenticatedSessionScope(scope, { ...scope })).toBe(true);
    expect(
      isSameAuthenticatedSessionScope(scope, {
        ...scope,
        subject: "subject:member_2" as SessionSubject,
      }),
    ).toBe(false);
    expect(isSameAuthenticatedSessionScope(scope, { ...scope, epoch: 5 })).toBe(
      false,
    );
    expect(
      isSameAuthenticatedSessionScope(scope, {
        ...scope,
        runtimeLeaseId:
          "20000000-0000-4000-8000-000000000002" as SessionRuntimeLeaseId,
      }),
    ).toBe(false);
  });
});
