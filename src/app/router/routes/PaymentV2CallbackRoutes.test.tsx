import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../../platform/session/sessionScope";
import {
  anotherTestSessionRuntimeLeaseId,
  testSessionRuntimeLeaseId,
} from "../../../test/sessionFixtures";
import { bookingPaymentStateCodec } from "../codecs/bookingPaymentStateCodec";
import PaymentFailRoute from "./PaymentFailRoute";
import PaymentSuccessRoute from "./PaymentSuccessRoute";

const mocks = vi.hoisted(() => ({
  acknowledgeTerminal: vi.fn(),
  claimCallback: vi.fn(),
  consumePendingCallbackCredential: vi.fn(),
  credentialClaim: { status: "none" } as unknown,
  dispose: vi.fn(),
  failureClaim: { status: "invalid" } as unknown,
  fenceStatus: "none" as string,
  getPaymentOperation: vi.fn(),
  markRecoveryFence: vi.fn(),
  pollOperation: vi.fn(),
  reconcileCandidateOwner: vi.fn(),
  recoverClaimedCallback: vi.fn(),
  resumeConfirmation: vi.fn(),
}));

vi.mock("../PaymentCallbackCredentialBoundary", () => ({
  useConsumePendingPaymentCallbackCredential: () =>
    mocks.consumePendingCallbackCredential,
  useMarkPaymentRecoveryFence: () => mocks.markRecoveryFence,
  usePaymentCallbackCredentialClaim: () => mocks.credentialClaim,
  usePaymentCallbackFailureClaim: () => mocks.failureClaim,
  usePaymentRecoveryFenceStatus: () => mocks.fenceStatus,
}));

vi.mock("../../../platform/browser/windowNavigation", () => ({
  browserWindowNavigation: {
    getOrigin: () => "https://airbob.test",
    isCurrentHistoryEntry: () => true,
    openInNewTab: vi.fn(),
    replaceCurrentUrl: vi.fn(),
  },
}));

vi.mock("../../../workflows/booking-payment/journal", () => ({
  createBookingPaymentJournalRepository: () => ({
    reconcileCandidateOwner: (...args: unknown[]) =>
      mocks.reconcileCandidateOwner(...args),
  }),
}));

vi.mock("../../../workflows/booking-payment/transaction/recovery", () => ({
  createBookingPaymentRecoveryWorkflow: () => ({
    acknowledgeTerminal: (...args: unknown[]) =>
      mocks.acknowledgeTerminal(...args),
    claimCallback: (...args: unknown[]) => mocks.claimCallback(...args),
    dispose: () => mocks.dispose(),
    pollOperation: (...args: unknown[]) => mocks.pollOperation(...args),
    recoverClaimedCallback: (...args: unknown[]) =>
      mocks.recoverClaimedCallback(...args),
    resumeConfirmation: (...args: unknown[]) =>
      mocks.resumeConfirmation(...args),
  }),
}));

vi.mock("../../../features/reservations/payment/public", () => ({
  paymentApi: {
    getPaymentOperation: (...args: unknown[]) =>
      mocks.getPaymentOperation(...args),
  },
}));

const flowId = "10000000-0000-4000-8000-000000000001";
const reservationUid = "20000000-0000-4000-8000-000000000002";
const operationId = "30000000-0000-4000-8000-000000000003";
const scope: AuthenticatedSessionScope = {
  epoch: 3,
  runtimeLeaseId: testSessionRuntimeLeaseId,
  subject: "subject:payment_v2_route" as SessionSubject,
};
let activeRuntimeLeaseId = testSessionRuntimeLeaseId;

vi.mock("../../session/useSession", () => ({
  useSession: () => ({
    state: {
      status: "authenticated",
      epoch: scope.epoch,
      subject: scope.subject,
      viewer: {
        id: 7,
        email: "viewer@example.com",
        nickname: "뷰어",
        thumbnailImageUrl: null,
      },
      revalidation: { status: "idle" },
    },
    captureAuthenticatedSession: () => ({
      ...scope,
      runtimeLeaseId: activeRuntimeLeaseId,
    }),
    isCurrentSession: (candidate: AuthenticatedSessionScope) =>
      candidate.subject === scope.subject &&
      candidate.epoch === scope.epoch &&
      candidate.runtimeLeaseId === activeRuntimeLeaseId,
  }),
}));

const operationReference = {
  flowId,
  operationId,
  reservationUid,
} as const;

const reviewResult = {
  status: "unresolved",
  reference: operationReference,
  observation: {
    status: "REQUIRES_REVIEW",
    updatedAt: "2026-09-01T10:31:00Z",
    nextAction: "CONTACT_SUPPORT",
    retryAfterSeconds: 30,
    userFailureCode: "PAYMENT_REVIEW_REQUIRED",
    serverTime: "2026-09-01T10:31:01Z",
  },
} as const;

const renderRoute = (
  path: string,
  routePath: string,
  element: React.ReactElement,
  state: unknown = null,
) => {
  window.history.replaceState({ idx: 0, key: "default", usr: state }, "", path);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>,
  );
};

describe("v2 payment callback routes", () => {
  beforeEach(() => {
    activeRuntimeLeaseId = testSessionRuntimeLeaseId;
    mocks.acknowledgeTerminal.mockReset().mockReturnValue({
      status: "acknowledged",
    });
    mocks.claimCallback.mockReset();
    mocks.consumePendingCallbackCredential.mockReset();
    mocks.credentialClaim = { status: "none" };
    mocks.dispose.mockReset();
    mocks.failureClaim = { status: "invalid" };
    mocks.fenceStatus = "none";
    mocks.getPaymentOperation.mockReset();
    mocks.markRecoveryFence.mockReset();
    mocks.pollOperation.mockReset().mockResolvedValue(reviewResult);
    mocks.reconcileCandidateOwner.mockReset().mockReturnValue({
      status: "recovery-unavailable",
    });
    mocks.recoverClaimedCallback.mockReset().mockReturnValue({
      status: "invalid-callback",
    });
    mocks.resumeConfirmation.mockReset();
  });

  it("persists and reads back a flow reference before the first confirmation request", async () => {
    const events: string[] = [];
    const flowReference = {
      purpose: "booking-payment-flow-reference",
      version: 2,
      flowId,
      locator: { kind: "reservation", reservationUid },
    } as const;
    mocks.credentialClaim = {
      status: "fresh",
      fresh: {
        reservationUid,
        orderId: reservationUid,
        paymentKey: "private-provider-key",
        amount: 1_900,
        firstCapturedAt: Date.now(),
      },
    };
    mocks.claimCallback.mockImplementation(() => {
      events.push("claim");
      return { status: "confirmation-ready", reference: flowReference };
    });
    mocks.resumeConfirmation.mockImplementation(() => {
      expect(
        bookingPaymentStateCodec.parseFlowReference(window.history.state?.usr),
      ).toEqual(flowReference);
      expect(JSON.stringify(window.history.state)).not.toContain(
        "private-provider-key",
      );
      events.push("confirm");
      return Promise.resolve({
        status: "operation-accepted",
        reference: operationReference,
        cleanup: "complete",
      });
    });
    mocks.pollOperation.mockImplementation(() => {
      expect(
        bookingPaymentStateCodec.parseOperationReference(
          window.history.state?.usr,
        ),
      ).toEqual({
        purpose: "booking-payment-operation-reference",
        version: 2,
        ...operationReference,
      });
      events.push("poll");
      return Promise.resolve(reviewResult);
    });

    renderRoute(
      `/reservations/${reservationUid}/success`,
      "/reservations/:reservationUid/success",
      <PaymentSuccessRoute />,
    );

    await waitFor(() => expect(events).toEqual(["claim", "confirm", "poll"]));
    expect(
      screen.getByRole("heading", {
        name: "결제 확인이 필요합니다",
      }),
    ).toBeVisible();
    expect(mocks.claimCallback).toHaveBeenCalledTimes(1);
    expect(mocks.consumePendingCallbackCredential).toHaveBeenCalledOnce();
    expect(mocks.resumeConfirmation).toHaveBeenCalledWith(flowReference);
    expect(mocks.getPaymentOperation).not.toHaveBeenCalled();
  });

  it("recovers a candidate-claimed callback after scrubbed-route reload before any network request", async () => {
    const events: string[] = [];
    const flowReference = {
      purpose: "booking-payment-flow-reference",
      version: 2,
      flowId,
      locator: { kind: "reservation", reservationUid },
    } as const;
    mocks.recoverClaimedCallback.mockImplementation((candidateUid) => {
      expect(candidateUid).toBe(reservationUid);
      events.push("recover");
      return { status: "confirmation-ready", reference: flowReference };
    });
    mocks.resumeConfirmation.mockImplementation(() => {
      expect(
        bookingPaymentStateCodec.parseFlowReference(window.history.state?.usr),
      ).toEqual(flowReference);
      events.push("confirm");
      return Promise.resolve({
        status: "operation-accepted",
        reference: operationReference,
        cleanup: "complete",
      });
    });
    mocks.pollOperation.mockImplementation(() => {
      expect(
        bookingPaymentStateCodec.parseOperationReference(
          window.history.state?.usr,
        ),
      ).toEqual({
        purpose: "booking-payment-operation-reference",
        version: 2,
        ...operationReference,
      });
      events.push("poll");
      return Promise.resolve(reviewResult);
    });

    renderRoute(
      `/reservations/${reservationUid}/success`,
      "/reservations/:reservationUid/success",
      <PaymentSuccessRoute />,
    );

    await waitFor(() => expect(events).toEqual(["recover", "confirm", "poll"]));
    expect(mocks.claimCallback).not.toHaveBeenCalled();
    expect(mocks.recoverClaimedCallback).toHaveBeenCalledTimes(1);
    expect(mocks.getPaymentOperation).not.toHaveBeenCalled();
  });

  it("polls only from an exact operation reference", async () => {
    const state = {
      purpose: "booking-payment-operation-reference",
      version: 2,
      ...operationReference,
    } as const;

    renderRoute(
      `/reservations/${reservationUid}/success`,
      "/reservations/:reservationUid/success",
      <PaymentSuccessRoute />,
      state,
    );

    await waitFor(() =>
      expect(mocks.pollOperation).toHaveBeenCalledWith(operationReference),
    );
    expect(mocks.claimCallback).not.toHaveBeenCalled();
    expect(mocks.recoverClaimedCallback).not.toHaveBeenCalled();
    expect(mocks.resumeConfirmation).not.toHaveBeenCalled();
  });

  it("does not confirm or poll when the success route has no exact reference", async () => {
    renderRoute(
      `/reservations/${reservationUid}/success`,
      "/reservations/:reservationUid/success",
      <PaymentSuccessRoute />,
    );

    expect(
      await screen.findByText(
        "이 화면에서 결제 상태를 확인할 복구 식별자가 없습니다.",
      ),
    ).toBeVisible();
    expect(mocks.claimCallback).not.toHaveBeenCalled();
    expect(mocks.recoverClaimedCallback).toHaveBeenCalledWith(reservationUid);
    expect(mocks.resumeConfirmation).not.toHaveBeenCalled();
    expect(mocks.pollOperation).not.toHaveBeenCalled();
  });

  it("requires an explicit retry for a recovery-unavailable fence", async () => {
    mocks.fenceStatus = "recovery-unavailable";
    const state = {
      purpose: "booking-payment-operation-reference",
      version: 2,
      ...operationReference,
    } as const;
    renderRoute(
      `/reservations/${reservationUid}/success`,
      "/reservations/:reservationUid/success",
      <PaymentSuccessRoute />,
      state,
    );

    expect(mocks.pollOperation).not.toHaveBeenCalled();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "결제 상태 다시 확인",
      }),
    );

    await waitFor(() => expect(mocks.pollOperation).toHaveBeenCalledTimes(1));
    expect(mocks.markRecoveryFence).toHaveBeenCalledWith("none");
  });

  it("clears a generic recovery-unavailable fence only after explicit verified reconciliation", async () => {
    mocks.fenceStatus = "recovery-unavailable";
    mocks.reconcileCandidateOwner.mockReturnValue({ status: "ready" });
    renderRoute(
      `/reservations/${reservationUid}/success`,
      "/reservations/:reservationUid/success",
      <PaymentSuccessRoute />,
    );

    expect(mocks.recoverClaimedCallback).not.toHaveBeenCalled();
    expect(mocks.reconcileCandidateOwner).not.toHaveBeenCalled();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "결제 상태 다시 확인",
      }),
    );

    expect(mocks.reconcileCandidateOwner).toHaveBeenCalledWith(scope.subject);
    expect(mocks.markRecoveryFence).toHaveBeenCalledWith("none");
    expect(mocks.resumeConfirmation).not.toHaveBeenCalled();
    expect(mocks.pollOperation).not.toHaveBeenCalled();
  });

  it("suppresses reconciliation completion after the runtime lease changes", async () => {
    mocks.fenceStatus = "recovery-unavailable";
    mocks.reconcileCandidateOwner.mockImplementation(() => {
      activeRuntimeLeaseId = anotherTestSessionRuntimeLeaseId;
      return { status: "ready" };
    });
    renderRoute(
      `/reservations/${reservationUid}/success`,
      "/reservations/:reservationUid/success",
      <PaymentSuccessRoute />,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "결제 상태 다시 확인",
      }),
    );

    expect(mocks.reconcileCandidateOwner).toHaveBeenCalledWith(scope.subject);
    expect(mocks.markRecoveryFence).not.toHaveBeenCalled();
    expect(mocks.resumeConfirmation).not.toHaveBeenCalled();
    expect(mocks.pollOperation).not.toHaveBeenCalled();
  });

  it("resumes an exact candidate callback only after explicit fenced reconciliation", async () => {
    const flowReference = {
      purpose: "booking-payment-flow-reference",
      version: 2,
      flowId,
      locator: { kind: "reservation", reservationUid },
    } as const;
    mocks.fenceStatus = "recovery-unavailable";
    mocks.reconcileCandidateOwner.mockReturnValue({
      status: "recovery-required",
    });
    mocks.recoverClaimedCallback.mockReturnValue({
      status: "confirmation-ready",
      reference: flowReference,
    });
    mocks.resumeConfirmation.mockImplementation(() => {
      expect(
        bookingPaymentStateCodec.parseFlowReference(window.history.state?.usr),
      ).toEqual(flowReference);
      return Promise.resolve({
        status: "operation-accepted",
        reference: operationReference,
        cleanup: "complete",
      });
    });
    renderRoute(
      `/reservations/${reservationUid}/success`,
      "/reservations/:reservationUid/success",
      <PaymentSuccessRoute />,
    );

    expect(mocks.recoverClaimedCallback).not.toHaveBeenCalled();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "결제 상태 다시 확인",
      }),
    );

    await waitFor(() => expect(mocks.resumeConfirmation).toHaveBeenCalled());
    expect(mocks.reconcileCandidateOwner).toHaveBeenCalledWith(scope.subject);
    expect(mocks.recoverClaimedCallback).toHaveBeenCalledWith(reservationUid);
    expect(mocks.markRecoveryFence).toHaveBeenCalledWith("none");
  });

  it("treats provider failure data as presentation-only", async () => {
    const storageBefore = window.sessionStorage.length;
    renderRoute(
      `/reservations/${reservationUid}/fail?code=provider-code&message=provider-message&orderId=${reservationUid}`,
      "/reservations/:reservationUid/fail",
      <PaymentFailRoute />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "결제가 완료되지 않았습니다",
      }),
    ).toBeVisible();
    expect(window.sessionStorage.length).toBe(storageBefore);
    expect(mocks.claimCallback).not.toHaveBeenCalled();
    expect(mocks.resumeConfirmation).not.toHaveBeenCalled();
    expect(mocks.pollOperation).not.toHaveBeenCalled();
    expect(mocks.reconcileCandidateOwner).not.toHaveBeenCalled();
    expect(mocks.getPaymentOperation).not.toHaveBeenCalled();
  });
});
