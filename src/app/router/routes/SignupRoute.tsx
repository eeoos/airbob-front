import { useNavigate } from "react-router-dom";
import { SignupRoute as LegacySignupRoute } from "../../../features/auth/SignupRoute";

export function SignupRoute() {
  const navigate = useNavigate();

  return <LegacySignupRoute navigate={navigate} />;
}

export default SignupRoute;
