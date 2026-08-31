import { useLocation, useNavigate } from "react-router-dom";
import { browserWindowNavigation } from "../../../platform/browser/windowNavigation";
import { AuthController } from "../../../screens/auth/public";
import { useSession } from "../../session/useSession";
import { internalReturnTargetCodec } from "../codecs/internalReturnTargetCodec";
import { routeTo } from "../paths";

function LoginRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = useSession();
  const returnTarget = internalReturnTargetCodec.parse(location.state);
  const returnPath = returnTarget
    ? internalReturnTargetCodec.serialize(returnTarget)
    : null;
  const routeEntry = {
    hash: location.hash,
    key: location.key,
    pathname: location.pathname,
    search: location.search,
  };

  return (
    <AuthController
      mode="login"
      submitLogin={session.login}
      canComplete={() => {
        const scope = session.captureAuthenticatedSession();
        return (
          browserWindowNavigation.isCurrentHistoryEntry(routeEntry) &&
          scope !== null &&
          session.isCurrentSession(scope)
        );
      }}
      onSuccess={() => navigate(returnPath ?? routeTo.home())}
      onAlternate={() => navigate(routeTo.signup())}
    />
  );
}

export default LoginRoute;
