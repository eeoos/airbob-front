import React, { useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  HeaderSearchBar,
  getViewportFromSearchParams,
} from "../../features/search/appShell";
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
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [isSearchBarExpanded, setIsSearchBarExpanded] = useState(false);
  const shouldRenderSearch =
    headerMode === "default" || headerMode === "search";

  // Search 페이지이고 destination 파라미터가 없고 viewport 파라미터가 있으면 지도 드래그 모드
  const hasViewport = getViewportFromSearchParams(searchParams) !== null;
  const isMapDragMode = 
    location.pathname === ROUTE_PATHS.search &&
    !searchParams.get("destination") &&
    hasViewport;

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

        {/* 데스크탑 검색바 */}
        {shouldRenderSearch && (
          <div
            className={`${styles.searchBar} ${
              isSearchBarExpanded ? styles.searchBarExpanded : ""
            }`}
          >
            <HeaderSearchBar
              onExpandedChange={setIsSearchBarExpanded}
              isMapDragMode={isMapDragMode}
            />
          </div>
        )}

        <div className={styles.menu}>
          <UserMenu isLoggedIn={isAuthenticated} />
        </div>
      </div>

      {/* 모바일 검색바 - 로고/메뉴 아래에 항상 표시 */}
      {shouldRenderSearch && (
        <div className={styles.mobileSearchRow}>
          <HeaderSearchBar
            onExpandedChange={setIsSearchBarExpanded}
            isMapDragMode={isMapDragMode}
          />
        </div>
      )}
    </header>
  );
};
