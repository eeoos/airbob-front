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

  const handleMobileSearchClick = () => {
    navigate("/search");
  };

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.logo} onClick={handleLogoClick}>
          <img src={logoImage} alt="Airbob" className={styles.logoImage} />
        </div>
        
        <div className={`${styles.searchBar} ${isSearchBarExpanded ? styles.searchBarExpanded : ""}`}>
          <SearchBar onExpandedChange={setIsSearchBarExpanded} isMapDragMode={isMapDragMode} />
        </div>

        {/* 모바일 검색 버튼 - 검색바가 숨겨질 때 표시 */}
        <button 
          className={styles.mobileSearchButton}
          onClick={handleMobileSearchClick}
          aria-label="검색"
        >
          <svg viewBox="0 0 32 32" fill="currentColor">
            <path d="M13 0c7.18 0 13 5.82 13 13 0 2.868-.93 5.52-2.502 7.68l7.607 7.608-1.414 1.414-7.607-7.607C18.52 25.07 15.868 26 13 26 5.82 26 0 20.18 0 13S5.82 0 13 0zm0 2C7.477 2 3 6.477 3 12s4.477 10 10 10 10-4.477 10-10S18.523 2 13 2z" />
          </svg>
          <span className={styles.mobileSearchText}>어디로 여행가세요?</span>
        </button>

        <div className={styles.menu}>
          <UserMenu isLoggedIn={isAuthenticated} />
        </div>
      </div>
    </header>
  );
};

