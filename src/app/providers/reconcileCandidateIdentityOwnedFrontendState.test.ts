import type { AuthenticatedSessionScope } from "../../platform/session/sessionScope";
import type { SessionRuntimeLeaseId } from "../../platform/session/runtimeLeaseId";
import { toSessionSubject } from "../session/sessionState";
import { reconcileCandidateIdentityOwnedFrontendState } from "./reconcileCandidateIdentityOwnedFrontendState";

const scope: AuthenticatedSessionScope = {
  subject: toSessionSubject({
    id: 41,
    email: "candidate@example.com",
    nickname: "Candidate",
    thumbnailImageUrl: null,
  }),
  epoch: 3,
  runtimeLeaseId:
    "10000000-0000-4000-8000-000000000001" as SessionRuntimeLeaseId,
};

describe("candidate identity-owned frontend state reconciliation", () => {
  it.each(["ready", "recovery-required"] as const)(
    "allows candidate publication for %s without exposing recovery data",
    (status) => {
      const reconcileCandidateOwner = vi.fn(() => ({ status }) as const);

      expect(() =>
        reconcileCandidateIdentityOwnedFrontendState(scope, {
          reconcileCandidateOwner,
        }),
      ).not.toThrow();
      expect(reconcileCandidateOwner).toHaveBeenCalledWith(scope.subject);
      expect(reconcileCandidateOwner).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { status: "blocked", reason: "unknown-v2-state" } as const,
    {
      status: "storage-error",
      error: { kind: "storage-unavailable", operation: "keys" },
    } as const,
  ])("fails closed with redacted copy for $status", (result) => {
    const reconcileCandidateOwner = vi.fn(() => result);

    expect(() =>
      reconcileCandidateIdentityOwnedFrontendState(scope, {
        reconcileCandidateOwner,
      }),
    ).toThrow("Candidate identity-owned state could not be reconciled.");
    expect(reconcileCandidateOwner).toHaveBeenCalledWith(scope.subject);
  });

  it("does not preserve a repository exception or payload in the published error", () => {
    const reconcileCandidateOwner = vi.fn(() => {
      throw new Error("opaque storage payload must not escape");
    });

    expect(() =>
      reconcileCandidateIdentityOwnedFrontendState(scope, {
        reconcileCandidateOwner,
      }),
    ).toThrow("Candidate identity-owned state could not be reconciled.");
  });
});
