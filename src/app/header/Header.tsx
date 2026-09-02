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
import { useSession } from "../session/useSession";
import { brandAssets } from "../../shared/assets/manifest";
import type { RouteHeaderPolicy } from "../router/definitions";
import { ROUTE_PATHS, routeTo } from "../router/paths";
import styles from "./Header.module.css";

interface HeaderProps {
  headerMode?: RouteHeaderPolicy;
}

export const Header: React.FC<HeaderProps> = ({ headerMode = "default" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state } = useSession();
  const isAuthenticated = state.status === "authenticated";
  const shouldRenderSearch =
    headerMode === "default" || headerMode === "search";
  const isSearchRoute = location.pathname === ROUTE_PATHS.search;
  const isSearchLayout = headerMode === "search";

  // Search 페이지이고 destination 파라미터가 없고 viewport 파라미터가 있으면 지도 드래그 모드
  const hasViewport = getViewportFromSearchParams(searchParams) !== null;
  const isMapDragMode =
    isSearchRoute && !searchParams.get("destination") && hasViewport;
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
      isSearchRoute,
      pushSearch,
      replaceSearch,
    }),
    [isSearchRoute, pushSearch, replaceSearch, searchParams],
  );

  return (
    <header
      className={`${styles.header} ${isSearchLayout ? styles.searchHeader : ""}`}
      data-layout={isSearchLayout ? "full-width" : "contained"}
    >
      <div
        className={`${styles.container} ${isSearchLayout ? styles.searchRouteContainer : ""}`}
        data-header-layout={isSearchLayout ? "full-width" : "contained"}
      >
        <Link
          to={routeTo.home()}
          className={styles.logo}
          aria-label="Airbob 홈으로 이동"
        >
          <img src={brandAssets.wordmark} alt="" className={styles.logoImage} />
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
