import {
  useCallback,
  createContext,
  type ReactElement,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  matchPath,
  UNSAFE_LocationContext as RouterLocationContext,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { browserWindowNavigation } from "../../platform/browser/windowNavigation";
import { paymentCodec } from "./codecs/paymentCodec";
import { ROUTE_PATHS, routeTo } from "./paths";

interface PaymentCallbackCredentialTuple {
  readonly reservationUid: string;
  readonly orderId: string;
  readonly paymentKey: string;
  readonly amount: number;
  readonly firstCapturedAt: number;
}

export type PaymentCallbackCredentialClaim =
  | { readonly status: "none" }
  | { readonly status: "invalid" }
  | {
      readonly status: "fresh";
      readonly fresh: PaymentCallbackCredentialTuple;
    };

type PaymentCallbackFailureReason = "confirm-failed" | "invalid-callback";

type PaymentCallbackFailureClaim =
  | { readonly status: "none" }
  | { readonly status: "invalid" }
  | {
      readonly status: "internal";
      readonly reason: PaymentCallbackFailureReason;
    };

const invalidClaim: PaymentCallbackCredentialClaim = Object.freeze({
  status: "invalid",
});

const noClaim: PaymentCallbackCredentialClaim = Object.freeze({
  status: "none",
});

const invalidFailureClaim: PaymentCallbackFailureClaim = Object.freeze({
  status: "invalid",
});

const noFailureClaim: PaymentCallbackFailureClaim = Object.freeze({
  status: "none",
});

export type PaymentRecoveryFenceStatus =
  "none" | "recovery-required" | "recovery-unavailable";

const PaymentCallbackCredentialContext =
  createContext<PaymentCallbackCredentialClaim>(invalidClaim);

const PaymentCallbackFailureContext =
  createContext<PaymentCallbackFailureClaim>(invalidFailureClaim);

const PaymentRecoveryFenceStatusContext =
  createContext<PaymentRecoveryFenceStatus>("none");

const PaymentRecoveryFenceCommandContext = createContext<
  ((status: PaymentRecoveryFenceStatus) => void) | null
>(null);

const hasWellFormedUrlEncoding = (value: string): boolean => {
  try {
    decodeURIComponent(value.replaceAll("+", " "));
    return true;
  } catch {
    return false;
  }
};

const captureCredentialClaim = (
  reservationUid: string | undefined,
  search: string,
  hash: string,
  hasRouterState: boolean,
  previousClaim: PaymentCallbackCredentialClaim,
  capturedAt: number,
): PaymentCallbackCredentialClaim => {
  if (search === "") {
    return hash === "" && !hasRouterState ? noClaim : invalidClaim;
  }
  if (hash !== "" || hasRouterState || !hasWellFormedUrlEncoding(search)) {
    return invalidClaim;
  }

  const params = new URLSearchParams(search);
  const exactKeys = ["paymentKey", "orderId", "amount"] as const;
  if (
    [...params.keys()].length !== exactKeys.length ||
    exactKeys.some((key) => params.getAll(key).length !== 1)
  ) {
    return invalidClaim;
  }

  const parsed = paymentCodec.parseSuccess(reservationUid, search);
  if (
    parsed.status === "invalid" ||
    parsed.paymentKey.trim() === "" ||
    parsed.paymentKey.length > 200
  ) {
    return invalidClaim;
  }

  const amount = Number(parsed.amount);
  const firstCapturedAt =
    previousClaim.status === "fresh" &&
    previousClaim.fresh.reservationUid === parsed.reservationUid &&
    previousClaim.fresh.orderId === parsed.orderId &&
    previousClaim.fresh.paymentKey === parsed.paymentKey &&
    previousClaim.fresh.amount === amount
      ? previousClaim.fresh.firstCapturedAt
      : capturedAt;

  return {
    status: "fresh",
    fresh: Object.freeze({
      reservationUid: parsed.reservationUid,
      orderId: parsed.orderId,
      paymentKey: parsed.paymentKey,
      amount,
      firstCapturedAt,
    }),
  };
};

const captureFailureClaim = (
  search: string,
  hash: string,
  hasRouterState: boolean,
): PaymentCallbackFailureClaim => {
  if (hash !== "" || hasRouterState) return invalidFailureClaim;
  if (search === "?reason=confirm-failed") {
    return Object.freeze({ status: "internal", reason: "confirm-failed" });
  }
  if (search === "?reason=invalid-callback") {
    return Object.freeze({ status: "internal", reason: "invalid-callback" });
  }

  return invalidFailureClaim;
};

interface PaymentCallbackCredentialBoundaryProps {
  readonly children: ReactElement;
  readonly now?: () => number;
}

interface CredentialLease {
  readonly routeKey: string | null;
  readonly claim: PaymentCallbackCredentialClaim;
  readonly failureClaim: PaymentCallbackFailureClaim;
}

/**
 * This boundary must keep the same element type for the application's entire
 * lifetime. Conditionally inserting a route-specific wrapper above
 * SessionProvider would remount the session and keyed QueryClient trees when a
 * payment route is entered or left.
 */
export function PaymentCallbackCredentialBoundary({
  children,
  now = Date.now,
}: PaymentCallbackCredentialBoundaryProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const locationContext = useContext(RouterLocationContext);
  // A later SPA callback keeps the mounted runtime on its last clean Router
  // snapshot while this boundary commits the browser + Router scrub.
  const safeLocationContextRef = useRef(locationContext);
  const successMatch = matchPath(
    { path: ROUTE_PATHS.paymentSuccess, end: true },
    location.pathname,
  );
  const failMatch = matchPath(
    { path: ROUTE_PATHS.paymentFail, end: true },
    location.pathname,
  );
  const successReservationUid = successMatch?.params.reservationUid;
  const failReservationUid = failMatch?.params.reservationUid;
  const routeKind = successReservationUid
    ? "success"
    : failReservationUid
      ? "fail"
      : null;
  const safePath = successReservationUid
    ? routeTo.paymentSuccess(successReservationUid)
    : failReservationUid
      ? routeTo.paymentFail(failReservationUid)
      : null;
  const routeKey = routeKind && safePath ? `${routeKind}:${safePath}` : null;
  const recoveryFenceRef = useRef<PaymentRecoveryFenceStatus>("none");
  const hasReleasedChildrenRef = useRef(false);
  const leaseRef = useRef<CredentialLease>({
    routeKey,
    claim: successReservationUid
      ? captureCredentialClaim(
          successReservationUid,
          location.search,
          location.hash,
          location.state !== null,
          noClaim,
          now(),
        )
      : noClaim,
    failureClaim: failReservationUid
      ? captureFailureClaim(
          location.search,
          location.hash,
          location.state !== null,
        )
      : noFailureClaim,
  });
  const publishedLeaseRef = useRef(leaseRef.current);
  const [routerSyncPath, setRouterSyncPath] = useState<string | null>(null);
  const [recoveryFenceStatus, setRecoveryFenceStatus] =
    useState<PaymentRecoveryFenceStatus>("none");

  const lease = leaseRef.current;
  if (lease.routeKey !== routeKey) {
    leaseRef.current = {
      routeKey,
      claim: !successReservationUid
        ? noClaim
        : recoveryFenceStatus !== "none"
          ? invalidClaim
          : captureCredentialClaim(
              successReservationUid,
              location.search,
              location.hash,
              location.state !== null,
              noClaim,
              now(),
            ),
      failureClaim: !failReservationUid
        ? noFailureClaim
        : recoveryFenceStatus !== "none"
          ? invalidFailureClaim
          : captureFailureClaim(
              location.search,
              location.hash,
              location.state !== null,
            ),
    };
  } else if (
    routeKey !== null &&
    (location.search !== "" || location.hash !== "" || location.state !== null)
  ) {
    leaseRef.current = {
      routeKey,
      claim: successReservationUid
        ? recoveryFenceStatus === "none"
          ? captureCredentialClaim(
              successReservationUid,
              location.search,
              location.hash,
              location.state !== null,
              leaseRef.current.claim,
              now(),
            )
          : invalidClaim
        : noClaim,
      failureClaim: failReservationUid
        ? recoveryFenceStatus === "none"
          ? captureFailureClaim(
              location.search,
              location.hash,
              location.state !== null,
            )
          : invalidFailureClaim
        : noFailureClaim,
    };
  }

  const markRecoveryFence = useCallback(
    (status: PaymentRecoveryFenceStatus) => {
      const previousStatus = recoveryFenceRef.current;
      recoveryFenceRef.current = status;
      setRecoveryFenceStatus(status);
      const currentLease = leaseRef.current;
      if (currentLease.routeKey === null) return;

      leaseRef.current = {
        ...currentLease,
        claim:
          status === "none"
            ? previousStatus === "none"
              ? currentLease.claim
              : invalidClaim
            : invalidClaim,
        failureClaim:
          status === "none"
            ? previousStatus === "none"
              ? currentLease.failureClaim
              : invalidFailureClaim
            : invalidFailureClaim,
      };
    },
    [],
  );

  useLayoutEffect(() => {
    if (
      safePath === null ||
      (location.search === "" &&
        location.hash === "" &&
        location.state === null)
    ) {
      return;
    }

    leaseRef.current = {
      routeKey,
      claim: successReservationUid
        ? recoveryFenceStatus === "none"
          ? captureCredentialClaim(
              successReservationUid,
              location.search,
              location.hash,
              location.state !== null,
              leaseRef.current.claim,
              now(),
            )
          : invalidClaim
        : noClaim,
      failureClaim: failReservationUid
        ? recoveryFenceStatus === "none"
          ? captureFailureClaim(
              location.search,
              location.hash,
              location.state !== null,
            )
          : invalidFailureClaim
        : noFailureClaim,
    };
    browserWindowNavigation.replaceCurrentUrl(safePath);
    setRouterSyncPath(safePath);
  }, [
    failReservationUid,
    location.hash,
    location.search,
    location.state,
    recoveryFenceStatus,
    routeKey,
    safePath,
    successReservationUid,
    now,
  ]);

  useEffect(() => {
    if (routerSyncPath === null) return;
    if (safePath !== routerSyncPath) {
      setRouterSyncPath(null);
      return;
    }

    navigate(routerSyncPath, { replace: true, state: null });
    setRouterSyncPath(null);
  }, [navigate, routerSyncPath, safePath]);

  const isScrubbingCurrentRoute =
    safePath !== null &&
    (location.search !== "" ||
      location.hash !== "" ||
      location.state !== null ||
      routerSyncPath === safePath);
  const shouldHoldChildren =
    isScrubbingCurrentRoute && !hasReleasedChildrenRef.current;
  if (!isScrubbingCurrentRoute) {
    safeLocationContextRef.current = locationContext;
    publishedLeaseRef.current = leaseRef.current;
    hasReleasedChildrenRef.current = true;
  }

  return (
    <PaymentRecoveryFenceCommandContext.Provider value={markRecoveryFence}>
      <PaymentRecoveryFenceStatusContext.Provider value={recoveryFenceStatus}>
        <RouterLocationContext.Provider value={safeLocationContextRef.current}>
          <PaymentCallbackCredentialContext.Provider
            value={publishedLeaseRef.current.claim}
          >
            <PaymentCallbackFailureContext.Provider
              value={publishedLeaseRef.current.failureClaim}
            >
              {shouldHoldChildren ? null : children}
            </PaymentCallbackFailureContext.Provider>
          </PaymentCallbackCredentialContext.Provider>
        </RouterLocationContext.Provider>
      </PaymentRecoveryFenceStatusContext.Provider>
    </PaymentRecoveryFenceCommandContext.Provider>
  );
}

export const usePaymentCallbackCredentialClaim = () =>
  useContext(PaymentCallbackCredentialContext);

export const usePaymentCallbackFailureClaim = () =>
  useContext(PaymentCallbackFailureContext);

export const useMarkPaymentRecoveryFence = () => {
  const markRecoveryFence = useContext(PaymentRecoveryFenceCommandContext);
  if (markRecoveryFence === null) {
    throw new Error(
      "Payment callback recovery fence must be used inside its boundary.",
    );
  }
  return markRecoveryFence;
};

export const usePaymentRecoveryFenceStatus = () =>
  useContext(PaymentRecoveryFenceStatusContext);
