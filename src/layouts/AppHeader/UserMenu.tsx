import React, { useEffect, useId, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useCreateAccommodationDraft } from "../../features/accommodations/appShell";
import { AuthModal } from "../../features/auth/appShell";
import { useApiError } from "../../hooks/useApiError";
import { routeTo } from "../../routes/paths";
import { useOutsideClick } from "../../shared/ui";
import { clientLogger } from "../../utils/clientLogger";
import styles from "./UserMenu.module.css";

interface UserMenuProps {
  isLoggedIn: boolean;
}

type PendingMenuFocus = "first" | "last" | null;

export const UserMenu: React.FC<UserMenuProps> = ({ isLoggedIn }) => {
  const navigate = useNavigate();
  const userMenuId = useId();
  const { logout } = useAuth();
  const { handleError } = useApiError();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [pendingMenuFocus, setPendingMenuFocus] =
    useState<PendingMenuFocus>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("login");
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { createDraft } = useCreateAccommodationDraft({
    onCreated: (accommodationId) => {
      // 숙소 초안 생성 성공 시 숙소 생성 폼 페이지로 이동 (새로 생성된 초안임을 표시)
      navigate(routeTo.accommodationEdit(accommodationId, { mode: "create" }));
    },
    onError: handleError,
  });

  useOutsideClick(menuRef, () => setIsMenuOpen(false), isMenuOpen);

  const getMenuItems = () =>
    menuItemRefs.current.filter(
      (item): item is HTMLButtonElement => item !== null,
    );

  const focusMenuItem = (index: number) => {
    const menuItems = getMenuItems();

    if (menuItems.length === 0) {
      return;
    }

    const nextIndex = (index + menuItems.length) % menuItems.length;
    menuItems[nextIndex]?.focus();
  };

  useEffect(() => {
    if (!isMenuOpen || !pendingMenuFocus) {
      return;
    }

    const menuItems = menuItemRefs.current.filter(
      (item): item is HTMLButtonElement => item !== null,
    );
    const focusIndex = pendingMenuFocus === "first" ? 0 : menuItems.length - 1;

    menuItems[focusIndex]?.focus();
    setPendingMenuFocus(null);
  }, [isMenuOpen, pendingMenuFocus]);

  const closeMenuAndRestoreFocus = () => {
    setPendingMenuFocus(null);
    setIsMenuOpen(false);
    menuButtonRef.current?.focus();
  };

  const openMenuAndFocus = (target: Exclude<PendingMenuFocus, null>) => {
    setPendingMenuFocus(target);
    setIsMenuOpen(true);
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.currentTarget === menuButtonRef.current && !isMenuOpen) {
      switch (event.key) {
        case "ArrowDown":
        case "Enter":
        case " ":
        case "Spacebar":
          event.preventDefault();
          openMenuAndFocus("first");
          return;
        case "ArrowUp":
          event.preventDefault();
          openMenuAndFocus("last");
          return;
        default:
          break;
      }
    }

    if (event.key === "Tab" && isMenuOpen) {
      setPendingMenuFocus(null);
      setIsMenuOpen(false);
      return;
    }

    const menuItems = getMenuItems();
    const currentIndex = menuItems.findIndex(
      (item) => item === document.activeElement,
    );

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusMenuItem(currentIndex >= 0 ? currentIndex + 1 : 0);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusMenuItem(currentIndex >= 0 ? currentIndex - 1 : menuItems.length - 1);
        break;
      case "Home":
        event.preventDefault();
        focusMenuItem(0);
        break;
      case "End":
        event.preventDefault();
        focusMenuItem(menuItems.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        closeMenuAndRestoreFocus();
        break;
      default:
        break;
    }
  };

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
    navigate(routeTo.wishlist());
    setIsMenuOpen(false);
  };

  const handleProfile = () => {
    navigate(routeTo.profile());
    setIsMenuOpen(false);
  };

  const handleHosting = async () => {
    setIsMenuOpen(false);
    await createDraft();
  };

  const handleLogout = async () => {
    try {
      await logout();
      setIsMenuOpen(false);
      navigate(routeTo.home());
    } catch (error) {
      clientLogger.error({ message: "Logout failed:", error });
      setIsMenuOpen(false);
    }
  };

  return (
    <>
      <div className={styles.menuWrapper}>
        {/* 프로필 아이콘 - 로그인 시에만 표시 (왼쪽) */}
        {isLoggedIn && (
          <button
            aria-label="프로필"
            className={styles.profileButton}
            onClick={handleProfile}
            type="button"
          >
            <svg viewBox="0 0 32 32" fill="currentColor" className={styles.icon}>
              <path d="M16 15.503A5.041 5.041 0 1016 5.42a5.041 5.041 0 000 10.083zm0 2.215c-6.703 0-11 3.699-11 5.5V24h22v-1.782c0-1.801-4.297-5.5-11-5.5z" />
            </svg>
          </button>
        )}

        {/* 메뉴 아이콘 - 항상 표시 (오른쪽) */}
        <div className={styles.menuContainer} ref={menuRef}>
          <button
            aria-controls={isMenuOpen ? userMenuId : undefined}
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            aria-label="사용자 메뉴"
            className={styles.menuButton}
            ref={menuButtonRef}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            onKeyDown={handleMenuKeyDown}
            type="button"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className={styles.icon}>
              <path d="M1 2.75A.75.75 0 011.75 2h12.5a.75.75 0 010 1.5H1.75A.75.75 0 011 2.75zm0 5A.75.75 0 011.75 7h12.5a.75.75 0 010 1.5H1.75A.75.75 0 011 7.75zM1.75 12a.75.75 0 000 1.5h12.5a.75.75 0 000-1.5H1.75z" />
            </svg>
          </button>

          {isMenuOpen && (
            <div
              aria-label="사용자 메뉴"
              className={styles.menuDropdown}
              id={userMenuId}
              onKeyDown={handleMenuKeyDown}
              role="menu"
            >
              {!isLoggedIn ? (
                <>
                  <button
                    className={styles.menuItem}
                    onClick={handleLogin}
                    ref={(node) => {
                      menuItemRefs.current[0] = node;
                    }}
                    role="menuitem"
                    type="button"
                  >
                    로그인
                  </button>
                  <button
                    className={styles.menuItem}
                    onClick={handleSignup}
                    ref={(node) => {
                      menuItemRefs.current[1] = node;
                    }}
                    role="menuitem"
                    type="button"
                  >
                    회원가입
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={styles.menuItem}
                    onClick={handleWishlist}
                    ref={(node) => {
                      menuItemRefs.current[0] = node;
                    }}
                    role="menuitem"
                    type="button"
                  >
                    위시리스트
                  </button>
                  <button
                    className={styles.menuItem}
                    onClick={handleProfile}
                    ref={(node) => {
                      menuItemRefs.current[1] = node;
                    }}
                    role="menuitem"
                    type="button"
                  >
                    프로필
                  </button>
                  <button
                    className={styles.menuItem}
                    onClick={handleHosting}
                    ref={(node) => {
                      menuItemRefs.current[2] = node;
                    }}
                    role="menuitem"
                    type="button"
                  >
                    호스팅 하기
                  </button>
                  <div
                    aria-orientation="horizontal"
                    className={styles.divider}
                    role="separator"
                  />
                  <button
                    className={styles.menuItem}
                    onClick={handleLogout}
                    ref={(node) => {
                      menuItemRefs.current[3] = node;
                    }}
                    role="menuitem"
                    type="button"
                  >
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
