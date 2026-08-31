import {
  createContext,
  type ReactElement,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import { browserWindowNavigation } from "../../platform/browser/windowNavigation";
import type { PaymentCallbackFreshTuple } from "../../workflows/booking-payment/confirmation";
import { paymentCodec } from "./codecs/paymentCodec";
import { ROUTE_PATHS, routeTo } from "./paths";

export type PaymentCallbackCredentialClaim =
  | { readonly status: "none" }
  | { readonly status: "invalid" }
  | {
      readonly status: "fresh";
      readonly fresh: PaymentCallbackFreshTuple;
    };

const invalidClaim: PaymentCallbackCredentialClaim = Object.freeze({
  status: "invalid",
});

const noClaim: PaymentCallbackCredentialClaim = Object.freeze({
  status: "none",
});

const PaymentCallbackCredentialContext =
  createContext<PaymentCallbackCredentialClaim>(invalidClaim);

const captureCredentialClaim = (
  reservationUid: string | undefined,
  search: string,
): PaymentCallbackCredentialClaim => {
  if (search === "") return { status: "none" };

  const parsed = paymentCodec.parseSuccess(reservationUid, search);
  if (parsed.status === "invalid") return invalidClaim;

  return {
    status: "fresh",
    fresh: Object.freeze({
      reservationUid: parsed.reservationUid,
      orderId: parsed.orderId,
      paymentKey: parsed.paymentKey,
      amount: Number(parsed.amount),
    }),
  };
};

interface PaymentCallbackCredentialBoundaryProps {
  readonly children: ReactElement;
}

interface CredentialLease {
  readonly routeKey: string | null;
  readonly sourceSearch: string;
  readonly claim: PaymentCallbackCredentialClaim;
}

/**
 * This boundary must keep the same element type for the application's entire
 * lifetime. Conditionally inserting a route-specific wrapper above
 * SessionProvider would remount the session and keyed QueryClient trees when a
 * payment route is entered or left.
 */
export function PaymentCallbackCredentialBoundary({
  children,
}: PaymentCallbackCredentialBoundaryProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const match = matchPath(
    { path: ROUTE_PATHS.paymentSuccess, end: true },
    location.pathname,
  );
  const reservationUid = match?.params.reservationUid;
  const routeKey = reservationUid ? location.pathname : null;
  const safePath = reservationUid
    ? routeTo.paymentSuccess(reservationUid)
    : null;
  const leaseRef = useRef<CredentialLease>({
    routeKey,
    sourceSearch: location.search,
    claim: reservationUid
      ? captureCredentialClaim(reservationUid, location.search)
      : noClaim,
  });
  const [routerSyncPath, setRouterSyncPath] = useState<string | null>(null);

  const lease = leaseRef.current;
  if (lease.routeKey !== routeKey) {
    leaseRef.current = {
      routeKey,
      sourceSearch: location.search,
      claim: reservationUid
        ? captureCredentialClaim(reservationUid, location.search)
        : noClaim,
    };
  } else if (
    reservationUid &&
    location.search !== "" &&
    lease.sourceSearch !== location.search
  ) {
    leaseRef.current = {
      routeKey,
      sourceSearch: location.search,
      claim: captureCredentialClaim(reservationUid, location.search),
    };
  }

  useLayoutEffect(() => {
    if (safePath === null || location.search === "") return;

    browserWindowNavigation.replaceCurrentUrl(safePath);
    setRouterSyncPath(safePath);
  }, [location.search, safePath]);

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
    (location.search !== "" || routerSyncPath === safePath);

  return (
    <PaymentCallbackCredentialContext.Provider value={leaseRef.current.claim}>
      {isScrubbingCurrentRoute ? null : children}
    </PaymentCallbackCredentialContext.Provider>
  );
}

export const usePaymentCallbackCredentialClaim = () =>
  useContext(PaymentCallbackCredentialContext);
