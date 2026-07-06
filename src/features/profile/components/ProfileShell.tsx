import React from "react";
import { Tabs } from "../../../shared/ui";
import type { ProfileRouteMode } from "../lib/profileRouteState";
import type { ProfileActiveTab } from "../lib/profileTabs";
import styles from "./ProfileShell.module.css";

type GuestProfileTab = "upcoming" | "past" | "cancelled";

const guestNavItems = [
  { value: "upcoming", label: "다가올 여행" },
  { value: "past", label: "이전 여행" },
  { value: "cancelled", label: "취소된 여행" },
] satisfies ReadonlyArray<{ value: GuestProfileTab; label: string }>;

type HostProfileSection = "listings" | "reservations";

const hostNavItems = [
  { value: "listings", label: "숙소 관리" },
  { value: "reservations", label: "예약 관리" },
] satisfies ReadonlyArray<{ value: HostProfileSection; label: string }>;

const modeItems = [
  { value: "guest", label: "게스트" },
  { value: "host", label: "호스트" },
] satisfies ReadonlyArray<{ value: ProfileRouteMode; label: string }>;

const isGuestProfileTab = (tab: ProfileActiveTab): tab is GuestProfileTab =>
  guestNavItems.some((item) => item.value === tab);

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
}) => {
  const activeHostSection: HostProfileSection = activeTab.startsWith("listings")
    ? "listings"
    : "reservations";
  const activeGuestTab = isGuestProfileTab(activeTab) ? activeTab : "upcoming";

  const handleHostSectionChange = (section: HostProfileSection) => {
    if (section === "listings") {
      onHostListingsClick();
      return;
    }

    onHostReservationsClick();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>프로필</h1>
        <Tabs
          ariaLabel="프로필 모드"
          className={styles.modeToggle}
          items={modeItems}
          selectedTabClassName={styles.active}
          tabClassName={styles.toggleButton}
          value={mode}
          variant="plain"
          onValueChange={onModeChange}
        />
      </div>
      <div className={styles.content}>
        <div className={styles.sidebar}>
          {mode === "guest" ? (
            <Tabs
              ariaLabel="게스트 프로필"
              className={styles.nav}
              items={guestNavItems}
              selectedTabClassName={styles.active}
              tabClassName={styles.navItem}
              value={activeGuestTab}
              orientation="vertical"
              variant="plain"
              onValueChange={onGuestTabChange}
            />
          ) : (
            <Tabs
              ariaLabel="호스트 프로필"
              className={styles.nav}
              items={hostNavItems}
              selectedTabClassName={styles.active}
              tabClassName={styles.navItem}
              value={activeHostSection}
              orientation="vertical"
              variant="plain"
              onValueChange={handleHostSectionChange}
            />
          )}
        </div>
        <div className={styles.main}>{children}</div>
      </div>
    </div>
  );
};
