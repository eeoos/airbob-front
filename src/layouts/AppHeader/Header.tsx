import React, { useCallback, useMemo } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  HeaderSearchBar,
  getViewportFromSearchParams,
  type SearchBarRoutePort,
} from "../../features/search/ui/HeaderSearchBar";
import { UserMenu } from "./UserMenu";
import { useAuth } from "../../hooks/useAuth";
import logoImage from "../../assets/logo/logo.png";
import { ROUTE_PATHS, routeTo } from "../../routes/paths";
import type { HeaderMode } from "../../routes/routeShell";
import styles from "./Header.module.css";

interface HeaderProps {
  headerMode?: HeaderMode;
}

export const Header: React.FC<HeaderProps> = ({ headerMode = "default" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const shouldRenderSearch =
    headerMode === "default" || headerMode === "search";

  // Search 페이지이고 destination 파라미터가 없고 viewport 파라미터가 있으면 지도 드래그 모드
  const hasViewport = getViewportFromSearchParams(searchParams) !== null;
  const isMapDragMode = 
    location.pathname === ROUTE_PATHS.search &&
    !searchParams.get("destination") &&
    hasViewport;
  const pushSearch = useCallback(
    (nextSearchParams: URLSearchParams) => {
      const query = nextSearchParams.toString();
      navigate(query ? `${ROUTE_PATHS.search}?${query}` : ROUTE_PATHS.search);
    },
    [navigate],
  );
  const replaceSearch = useCallback(
    (nextSearchParams: URLSearchParams) => {
      setSearchParams(nextSearchParams, { replace: true });
    },
    [setSearchParams],
  );
  const searchBarRoutePort = useMemo<SearchBarRoutePort>(
    () => ({
      currentSearchParams: searchParams,
      isSearchRoute: location.pathname === ROUTE_PATHS.search,
      pushSearch,
      replaceSearch,
    }),
    [location.pathname, pushSearch, replaceSearch, searchParams],
  );

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link
          to={routeTo.home()}
          className={styles.logo}
          aria-label="Airbob 홈으로 이동"
        >
          <img src={logoImage} alt="" className={styles.logoImage} />
        </Link>

        {shouldRenderSearch && (
          <div className={styles.searchBar}>
            <HeaderSearchBar
              isMapDragMode={isMapDragMode}
              routePort={searchBarRoutePort}
            />
          </div>
        )}

        <div className={styles.menu}>
          <UserMenu isLoggedIn={isAuthenticated} />
        </div>
      </div>
    </header>
  );
};
