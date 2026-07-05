import React from "react";
import { useSearchParams } from "react-router-dom";
import { ProfileRoute } from "../../features/profile";

const Profile: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <ProfileRoute
      searchParams={searchParams}
      setSearchParams={setSearchParams}
    />
  );
};

export default Profile;
