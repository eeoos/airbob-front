import { useLocation, useNavigate } from "react-router-dom";
import { LoginRoute as LegacyLoginRoute } from "../../../features/auth/LoginRoute";
import { internalReturnTargetCodec } from "../codecs/internalReturnTargetCodec";

export function LoginRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const returnTarget = internalReturnTargetCodec.parse(location.state);

  return (
    <LegacyLoginRoute
      locationState={returnTarget ? { from: returnTarget } : null}
      navigate={navigate}
    />
  );
}

export default LoginRoute;
