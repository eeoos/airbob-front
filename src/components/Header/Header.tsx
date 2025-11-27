import React, { useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { SearchBar } from "../SearchBar/SearchBar";
import { UserMenu } from "./UserMenu";
import { useAuth } from "../../hooks/useAuth";
import logoImage from "../../assets/logo/logo.png";
import styles from "./Header.module.css";

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [isSearchBarExpanded, setIsSearchBarExpanded] = useState(false);

  const handleLogoClick = () => {
    navigate("/");
  };

  // Search 페이지이고 destination 파라미터가 없고 viewport 파라미터가 있으면 지도 드래그 모드
  const isMapDragMode = 
    location.pathname === "/search" &&
    !searchParams.get("destination") &&
    !!searchParams.get("topLeftLat") &&
    !!searchParams.get("topLeftLng");

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.logo} onClick={handleLogoClick}>
          <img src={logoImage} alt="Airbob" className={styles.logoImage} />
        </div>
        
        {/* 데스크탑 검색바 */}
        <div className={`${styles.searchBar} ${isSearchBarExpanded ? styles.searchBarExpanded : ""}`}>
          <SearchBar onExpandedChange={setIsSearchBarExpanded} isMapDragMode={isMapDragMode} />
        </div>

        <div className={styles.menu}>
          <UserMenu isLoggedIn={isAuthenticated} />
        </div>
      </div>

      {/* 모바일 검색바 - 로고/메뉴 아래에 항상 표시 */}
      <div className={styles.mobileSearchRow}>
        <SearchBar onExpandedChange={setIsSearchBarExpanded} isMapDragMode={isMapDragMode} />
      </div>
    </header>
  );
};

