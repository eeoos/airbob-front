import { useLocation, useNavigate } from "react-router-dom";
import { useAuthCommands } from "../../../features/auth/ports/AuthCommandProvider";
import { browserWindowNavigation } from "../../../platform/browser/windowNavigation";
import { AuthController } from "../../../screens/auth/public";
import { routeTo } from "../paths";

function SignupRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const commands = useAuthCommands();
  const routeEntry = {
    hash: location.hash,
    key: location.key,
    pathname: location.pathname,
    search: location.search,
  };

  return (
    <AuthController
      mode="signup"
      submitSignup={commands.signup}
      canComplete={() =>
        browserWindowNavigation.isCurrentHistoryEntry(routeEntry)
      }
      onSuccess={() => navigate(routeTo.login())}
      onAlternate={() => navigate(routeTo.login())}
    />
  );
}

export default SignupRoute;
