import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DeferredAuthModal } from "../../features/auth/public";
import { browserWindowNavigation } from "../../platform/browser/windowNavigation";
import { useSession } from "../session/useSession";
import { usePendingPaymentRecoveryReturn } from "./PaymentCallbackCredentialBoundary";
import { internalReturnTargetCodec } from "./codecs/internalReturnTargetCodec";
import { routeTo } from "./paths";

function RequestedLoginModal({ returnTo }: { readonly returnTo: unknown }) {
  const location = useLocation();
  const navigate = useNavigate();
  const session = useSession();
  const readPendingPaymentRecoveryReservation =
    usePendingPaymentRecoveryReturn();

  useEffect(() => {
    const scope = session.captureAuthenticatedSession();
    if (
      scope === null ||
      !session.isCurrentSession(scope) ||
      !browserWindowNavigation.isCurrentHistoryEntry(location)
    ) {
      return;
    }

    const pendingReservationUid = readPendingPaymentRecoveryReservation();
    const paymentTarget = pendingReservationUid
      ? internalReturnTargetCodec.parseClaimedPaymentRecovery(
          returnTo,
          routeTo.paymentSuccess(pendingReservationUid),
        )
      : null;
    const returnPath = internalReturnTargetCodec.canonicalize(returnTo);
    navigate(paymentTarget?.pathname ?? returnPath ?? routeTo.home(), {
      replace: true,
      state: null,
    });
  }, [
    location,
    navigate,
    readPendingPaymentRecoveryReservation,
    returnTo,
    session,
  ]);

  return (
    <DeferredAuthModal
      isOpen
      onClose={() => navigate(routeTo.home(), { replace: true, state: null })}
    />
  );
}

export function HomeLoginModal() {
  const { state }: { state: unknown } = useLocation();
  if (
    typeof state !== "object" ||
    state === null ||
    !("authModal" in state) ||
    state.authModal !== "login"
  ) {
    return null;
  }

  return (
    <RequestedLoginModal
      returnTo={"returnTo" in state ? state.returnTo : null}
    />
  );
}
