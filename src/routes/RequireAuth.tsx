import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { routeTo } from "./paths";

interface RequireAuthProps {
  children: React.ReactElement;
}

const RequireAuth = ({ children }: RequireAuthProps) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>로딩 중...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to={routeTo.home()} replace />;
  }

  return children;
};

export default RequireAuth;
