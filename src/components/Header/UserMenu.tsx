import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { accommodationApi } from "../../api";
import { AuthModal } from "../AuthModal";
import { useApiError } from "../../hooks/useApiError";
import styles from "./UserMenu.module.css";

interface UserMenuProps {
  isLoggedIn: boolean;
}

export const UserMenu: React.FC<UserMenuProps> = ({ isLoggedIn }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { handleError } = useApiError();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("login");
  const [isCreating, setIsCreating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleLogin = () => {
    setAuthModalMode("login");
    setIsAuthModalOpen(true);
    setIsMenuOpen(false);
  };

  const handleSignup = () => {
    setAuthModalMode("signup");
    setIsAuthModalOpen(true);
    setIsMenuOpen(false);
  };

  const handleWishlist = () => {
    navigate("/wishlist");
    setIsMenuOpen(false);
  };

  const handleProfile = () => {
    navigate("/profile");
    setIsMenuOpen(false);
  };

  const handleHosting = async () => {
    setIsMenuOpen(false);
    setIsCreating(true);
    
    try {
      const response = await accommodationApi.create();
      // 숙소 초안 생성 성공 시 숙소 생성 폼 페이지로 이동 (새로 생성된 초안임을 표시)
      navigate(`/accommodations/${response.id}/edit?mode=create`);
    } catch (error) {
      handleError(error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsMenuOpen(false);
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
      setIsMenuOpen(false);
    }
  };

  return (
    <>
      <div className={styles.menuWrapper}>
        {/* 프로필 아이콘 - 로그인 시에만 표시 (왼쪽) */}
        {isLoggedIn && (
          <button className={styles.profileButton} onClick={handleProfile}>
            <svg viewBox="0 0 32 32" fill="currentColor" className={styles.icon}>
              <path d="M16 15.503A5.041 5.041 0 1016 5.42a5.041 5.041 0 000 10.083zm0 2.215c-6.703 0-11 3.699-11 5.5V24h22v-1.782c0-1.801-4.297-5.5-11-5.5z" />
            </svg>
          </button>
        )}

        {/* 메뉴 아이콘 - 항상 표시 (오른쪽) */}
        <div className={styles.menuContainer} ref={menuRef}>
          <button className={styles.menuButton} onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <svg viewBox="0 0 16 16" fill="currentColor" className={styles.icon}>
              <path d="M1 2.75A.75.75 0 011.75 2h12.5a.75.75 0 010 1.5H1.75A.75.75 0 011 2.75zm0 5A.75.75 0 011.75 7h12.5a.75.75 0 010 1.5H1.75A.75.75 0 011 7.75zM1.75 12a.75.75 0 000 1.5h12.5a.75.75 0 000-1.5H1.75z" />
            </svg>
          </button>

          {isMenuOpen && (
            <div className={styles.menuDropdown}>
              {!isLoggedIn ? (
                <>
                  <button className={styles.menuItem} onClick={handleLogin}>
                    로그인
                  </button>
                  <button className={styles.menuItem} onClick={handleSignup}>
                    회원가입
                  </button>
                </>
              ) : (
                <>
                  <button className={styles.menuItem} onClick={handleWishlist}>
                    위시리스트
                  </button>
                  <button className={styles.menuItem} onClick={handleProfile}>
                    프로필
                  </button>
                  <button className={styles.menuItem} onClick={handleHosting}>
                    호스팅 하기
                  </button>
                  <div className={styles.divider} />
                  <button className={styles.menuItem} onClick={handleLogout}>
                    로그아웃
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </>
  );
};

