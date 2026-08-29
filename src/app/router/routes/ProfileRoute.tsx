import { useSearchParams } from "react-router-dom";
import { ProfileRoute as LegacyProfileRoute } from "../../../features/profile/ProfileRoute";

export function ProfileRoute() {
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <LegacyProfileRoute
      searchParams={searchParams}
      setSearchParams={setSearchParams}
    />
  );
}

export default ProfileRoute;
