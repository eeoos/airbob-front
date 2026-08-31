import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Button, ErrorState, LoadingState } from "../../shared/ui";
import { useSession } from "../session/useSession";
import { routeTo } from "./paths";

interface RequireAuthenticatedRouteProps {
  children: React.ReactElement;
}

export function RequireAuthenticatedRoute({
  children,
}: RequireAuthenticatedRouteProps) {
  const { revalidate, state } = useSession();
  const location = useLocation();

  if (state.status === "checking") {
    return <LoadingState title="로그인 상태를 확인하는 중..." />;
  }

  if (state.status === "error") {
    return (
      <ErrorState
        title="로그인 상태를 확인하지 못했어요"
        description="연결을 확인한 뒤 다시 시도해 주세요."
        action={
          <Button
            type="button"
            onClick={() => void revalidate().catch(() => undefined)}
          >
            다시 시도
          </Button>
        }
      />
    );
  }

  if (state.status === "anonymous") {
    return (
      <Navigate
        to={routeTo.login()}
        replace
        state={{
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
        }}
      />
    );
  }

  return children;
}
