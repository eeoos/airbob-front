import type { ReactNode } from "react";
import { Tabs } from "../../../shared/ui";
import styles from "./ProfileShell.module.css";

export type GuestProfileTab = "upcoming" | "past" | "cancelled";
export type HostProfileSection = "listings" | "reservations";
export type ProfileMode = "guest" | "host";

const guestNavItems = [
  { value: "upcoming", label: "다가올 여행" },
  { value: "past", label: "이전 여행" },
  { value: "cancelled", label: "취소된 여행" },
] satisfies ReadonlyArray<{ value: GuestProfileTab; label: string }>;

const hostNavItems = [
  { value: "listings", label: "숙소 관리" },
  { value: "reservations", label: "예약 관리" },
] satisfies ReadonlyArray<{ value: HostProfileSection; label: string }>;

const modeItems = [
  { value: "guest", label: "게스트" },
  { value: "host", label: "호스트" },
] satisfies ReadonlyArray<{ value: ProfileMode; label: string }>;

interface ProfileShellBaseProps {
  readonly children: ReactNode;
  readonly onModeChange: (mode: ProfileMode) => void;
}

export type ProfileShellProps = ProfileShellBaseProps &
  (
    | {
        readonly mode: "guest";
        readonly activeTab: GuestProfileTab;
        readonly onTabChange: (tab: GuestProfileTab) => void;
      }
    | {
        readonly mode: "host";
        readonly activeTab: HostProfileSection;
        readonly onTabChange: (section: HostProfileSection) => void;
      }
  );

export function ProfileShell(props: ProfileShellProps) {
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
          value={props.mode}
          variant="plain"
          onValueChange={props.onModeChange}
        />
      </div>
      <div className={styles.content}>
        <div className={styles.sidebar}>
          {props.mode === "guest" ? (
            <Tabs
              ariaLabel="게스트 프로필"
              className={styles.nav}
              items={guestNavItems}
              selectedTabClassName={styles.active}
              tabClassName={styles.navItem}
              value={props.activeTab}
              orientation="vertical"
              variant="plain"
              onValueChange={props.onTabChange}
            />
          ) : (
            <Tabs
              ariaLabel="호스트 프로필"
              className={styles.nav}
              items={hostNavItems}
              selectedTabClassName={styles.active}
              tabClassName={styles.navItem}
              value={props.activeTab}
              orientation="vertical"
              variant="plain"
              onValueChange={props.onTabChange}
            />
          )}
        </div>
        <div className={styles.main}>{props.children}</div>
      </div>
    </div>
  );
}
