import { Navigate, useLocation } from "react-router-dom";
import { usePendingPaymentRecoveryReturn } from "../PaymentCallbackCredentialBoundary";
import { internalReturnTargetCodec } from "../codecs/internalReturnTargetCodec";
import { routeTo } from "../paths";

function LoginRoute() {
  const location = useLocation();
  const readPendingPaymentRecoveryReservation =
    usePendingPaymentRecoveryReturn();
  const pendingReservationUid = readPendingPaymentRecoveryReservation();
  const returnTarget =
    internalReturnTargetCodec.parse(location.state) ??
    (pendingReservationUid
      ? internalReturnTargetCodec.parseClaimedPaymentRecovery(
          location.state,
          routeTo.paymentSuccess(pendingReservationUid),
        )
      : null);

  return (
    <Navigate
      to={routeTo.home()}
      replace
      state={{
        authModal: "login",
        returnTo: returnTarget ? { from: returnTarget } : null,
      }}
    />
  );
}

export default LoginRoute;
