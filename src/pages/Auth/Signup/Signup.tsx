import { useNavigate } from "react-router-dom";
import { SignupRoute } from "../../../features/auth";

const Signup = () => {
  const navigate = useNavigate();

  return <SignupRoute navigate={navigate} />;
};

export default Signup;
