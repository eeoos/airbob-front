import type { AuthenticatedSessionScope } from "../../platform/session/sessionScope";
import type { SessionRuntimeLeaseId } from "../../platform/session/runtimeLeaseId";
import { toSessionSubject } from "../session/sessionState";
import {
  claimCandidatePaymentCallbackCredential,
  reconcileCandidateIdentityOwnedFrontendState,
} from "./reconcileCandidateIdentityOwnedFrontendState";

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
  it.each(["claimed", "unchanged", "found"] as const)(
    "joins a pending callback without exposing authority for %s",
    (status) => {
      const claimCallbackCredential = vi.fn(() => ({ status }));
      const repository = {
        recoveryRecords: { claimCallbackCredential },
      } as unknown as Parameters<
        typeof claimCandidatePaymentCallbackCredential
      >[2];
      const callback = {
        reservationUid: "10000000-0000-4000-8000-000000000001",
        orderId: "10000000-0000-4000-8000-000000000001",
        paymentKey: "payment-key-1",
        amount: 120000,
        firstCapturedAt: 1_000,
      };

      expect(
        claimCandidatePaymentCallbackCredential(scope, callback, repository),
      ).toBe("claimed");
      expect(claimCallbackCredential).toHaveBeenCalledWith({
        owner: scope.subject,
        lease: {
          runtimeLeaseId: scope.runtimeLeaseId,
          sessionEpoch: scope.epoch,
        },
        ...callback,
        isCurrent: expect.any(Function),
      });
    },
  );

  it("returns status only when a pending callback cannot be joined", () => {
    const repository = {
      recoveryRecords: {
        claimCallbackCredential: vi.fn(() => ({
          status: "rejected",
          reason: "foreign-owner",
        })),
      },
    } as unknown as Parameters<
      typeof claimCandidatePaymentCallbackCredential
    >[2];

    expect(
      claimCandidatePaymentCallbackCredential(
        scope,
        {
          reservationUid: "10000000-0000-4000-8000-000000000001",
          orderId: "10000000-0000-4000-8000-000000000001",
          paymentKey: "payment-key-1",
          amount: 120000,
          firstCapturedAt: 1_000,
        },
        repository,
      ),
    ).toBe("not-claimed");
  });

  it("blocks candidate publication when callback storage cannot be inspected", () => {
    const repository = {
      recoveryRecords: {
        claimCallbackCredential: vi.fn(() => ({
          status: "storage-error",
          error: { kind: "storage-unavailable", operation: "get" },
        })),
      },
    } as unknown as Parameters<
      typeof claimCandidatePaymentCallbackCredential
    >[2];

    expect(
      claimCandidatePaymentCallbackCredential(
        scope,
        {
          reservationUid: "10000000-0000-4000-8000-000000000001",
          orderId: "10000000-0000-4000-8000-000000000001",
          paymentKey: "payment-key-1",
          amount: 120000,
          firstCapturedAt: 1_000,
        },
        repository,
      ),
    ).toBe("blocked");
  });

  it.each(["ready", "recovery-required", "recovery-unavailable"] as const)(
    "returns the status-only %s result without exposing recovery data",
    (status) => {
      const reconcileCandidateOwner = vi.fn(() => ({ status }) as const);

      expect(
        reconcileCandidateIdentityOwnedFrontendState(scope, {
          reconcileCandidateOwner,
        }),
      ).toBe(status);
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
