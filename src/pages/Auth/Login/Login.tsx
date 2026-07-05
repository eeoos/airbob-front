import { useLocation, useNavigate } from "react-router-dom";
import { LoginRoute } from "../../../features/auth";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return <LoginRoute locationState={location.state} navigate={navigate} />;
};

export default Login;
