import React from "react";
import type { ProfileRouteMode } from "../lib/profileRouteState";
import type { ProfileActiveTab } from "../lib/profileTabs";
import styles from "../../../pages/Profile/Profile.module.css";

type GuestProfileTab = "upcoming" | "past" | "cancelled";

const guestNavItems = [
  ["upcoming", "다가올 여행"],
  ["past", "이전 여행"],
  ["cancelled", "취소된 여행"],
] satisfies ReadonlyArray<readonly [GuestProfileTab, string]>;

interface ProfileShellProps {
  mode: ProfileRouteMode;
  activeTab: ProfileActiveTab;
  onModeChange: (mode: ProfileRouteMode) => void;
  onGuestTabChange: (tab: GuestProfileTab) => void;
  onHostListingsClick: () => void;
  onHostReservationsClick: () => void;
  children: React.ReactNode;
}

export const ProfileShell: React.FC<ProfileShellProps> = ({
  activeTab,
  children,
  mode,
  onGuestTabChange,
  onHostListingsClick,
  onHostReservationsClick,
  onModeChange,
}) => (
  <div className={styles.container}>
    <div className={styles.header}>
      <h1 className={styles.title}>프로필</h1>
      <div className={styles.modeToggle}>
        <button
          type="button"
          className={`${styles.toggleButton} ${
            mode === "guest" ? styles.active : ""
          }`}
          onClick={() => onModeChange("guest")}
        >
          게스트
        </button>
        <button
          type="button"
          className={`${styles.toggleButton} ${
            mode === "host" ? styles.active : ""
          }`}
          onClick={() => onModeChange("host")}
        >
          호스트
        </button>
      </div>
    </div>
    <div className={styles.content}>
      <div className={styles.sidebar}>
        {mode === "guest" ? (
          <nav className={styles.nav} aria-label="게스트 프로필">
            {guestNavItems.map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                className={`${styles.navItem} ${
                  activeTab === tab ? styles.active : ""
                }`}
                onClick={() => onGuestTabChange(tab)}
              >
                {label}
              </button>
            ))}
          </nav>
        ) : (
          <nav className={styles.nav} aria-label="호스트 프로필">
            <button
              type="button"
              className={`${styles.navItem} ${
                activeTab.startsWith("listings") ? styles.active : ""
              }`}
              onClick={onHostListingsClick}
            >
              숙소 관리
            </button>
            <button
              type="button"
              className={`${styles.navItem} ${
                activeTab.startsWith("reservations") ? styles.active : ""
              }`}
              onClick={onHostReservationsClick}
            >
              예약 관리
            </button>
          </nav>
        )}
      </div>
      <div className={styles.main}>{children}</div>
    </div>
  </div>
);
