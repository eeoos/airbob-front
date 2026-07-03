import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import GuestTrips from "./GuestTrips/GuestTrips";
import HostListings from "./HostListings/HostListings";
import HostReservations from "./HostReservations/HostReservations";
import {
  buildProfileRouteSearchParams,
  parseProfileRouteState,
  ProfileRouteState,
  ProfileRouteTab,
} from "../../features/profile/lib/profileRouteState";
import styles from "./Profile.module.css";

type ProfileMode = "guest" | "host";

const getActiveTabFromRouteTab = (tab: ProfileRouteTab): string => {
  if (tab === "trips") {
    return "upcoming";
  }

  if (tab === "listings") {
    return "listings-published";
  }

  if (tab === "reservations") {
    return "reservations-upcoming";
  }

  return tab;
};

const Profile: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRouteState = parseProfileRouteState(searchParams);
  
  const [mode, setMode] = useState<ProfileMode>(initialRouteState.mode);
  const [activeTab, setActiveTab] = useState<string>(
    getActiveTabFromRouteTab(initialRouteState.tab)
  );

  useEffect(() => {
    const routeState = parseProfileRouteState(searchParams);

    setMode(routeState.mode);
    setActiveTab(getActiveTabFromRouteTab(routeState.tab));
  }, [searchParams]);

  const setProfileRouteState = (state: ProfileRouteState) => {
    setSearchParams(buildProfileRouteSearchParams(state), { replace: true });
  };

  return (
    <>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>프로필</h1>
          <div className={styles.modeToggle}>
            <button
              type="button"
              className={`${styles.toggleButton} ${mode === "guest" ? styles.active : ""}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMode("guest");
                setActiveTab("upcoming");
                setProfileRouteState({ mode: "guest", tab: "upcoming" });
              }}
            >
              게스트
            </button>
            <button
              type="button"
              className={`${styles.toggleButton} ${mode === "host" ? styles.active : ""}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMode("host");
                setActiveTab("listings");
                setProfileRouteState({ mode: "host", tab: "listings" });
              }}
            >
              호스트
            </button>
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.sidebar}>
            {mode === "guest" ? (
              <nav className={styles.nav}>
                <button
                  className={`${styles.navItem} ${activeTab === "upcoming" ? styles.active : ""}`}
                  onClick={() => {
                    setActiveTab("upcoming");
                    setProfileRouteState({ mode: "guest", tab: "upcoming" });
                  }}
                >
                  다가올 여행
                </button>
                <button
                  className={`${styles.navItem} ${activeTab === "past" ? styles.active : ""}`}
                  onClick={() => {
                    setActiveTab("past");
                    setProfileRouteState({ mode: "guest", tab: "past" });
                  }}
                >
                  이전 여행
                </button>
                <button
                  className={`${styles.navItem} ${activeTab === "cancelled" ? styles.active : ""}`}
                  onClick={() => {
                    setActiveTab("cancelled");
                    setProfileRouteState({ mode: "guest", tab: "cancelled" });
                  }}
                >
                  취소된 여행
                </button>
              </nav>
            ) : (
              <nav className={styles.nav}>
                <button
                  className={`${styles.navItem} ${activeTab === "listings" || 
                    activeTab === "listings-published" || 
                    activeTab === "listings-draft" || 
                    activeTab === "listings-unpublished" ? styles.active : ""}`}
                  onClick={() => {
                    setActiveTab("listings-published");
                    setProfileRouteState({ mode: "host", tab: "listings-published" });
                  }}
                >
                  숙소 관리
                </button>
                <button
                  className={`${styles.navItem} ${activeTab === "reservations" || 
                    activeTab === "reservations-upcoming" || 
                    activeTab === "reservations-past" || 
                    activeTab === "reservations-cancelled" ? styles.active : ""}`}
                  onClick={() => {
                    setActiveTab("reservations-upcoming");
                    setProfileRouteState({ mode: "host", tab: "reservations-upcoming" });
                  }}
                >
                  예약 관리
                </button>
              </nav>
            )}
          </div>

          <div className={styles.main}>
            {mode === "guest" ? (
              <GuestTrips filterType={
                activeTab === "upcoming" ? "UPCOMING" 
                : activeTab === "past" ? "PAST" 
                : activeTab === "cancelled" ? "CANCELLED"
                : "UPCOMING"
              } />
            ) : (
              <>
                {(activeTab === "listings" || 
                  activeTab === "listings-published" || 
                  activeTab === "listings-draft" || 
                  activeTab === "listings-unpublished") && (
                  <HostListings 
                    statusType={
                      activeTab === "listings-published" ? "PUBLISHED"
                      : activeTab === "listings-draft" ? "DRAFT"
                      : activeTab === "listings-unpublished" ? "UNPUBLISHED"
                      : "PUBLISHED"
                    }
                    onStatusChange={(newStatusType) => {
                      const newTab = 
                        newStatusType === "PUBLISHED" ? "listings-published"
                        : newStatusType === "DRAFT" ? "listings-draft"
                        : "listings-unpublished";
                      setActiveTab(newTab);
                      setProfileRouteState({ mode: "host", tab: newTab });
                    }}
                  />
                )}
                {(activeTab === "reservations" || 
                  activeTab === "reservations-upcoming" || 
                  activeTab === "reservations-past" || 
                  activeTab === "reservations-cancelled") && (
                  <HostReservations 
                    filterType={
                      activeTab === "reservations-upcoming" ? "UPCOMING"
                      : activeTab === "reservations-past" ? "PAST"
                      : activeTab === "reservations-cancelled" ? "CANCELLED"
                      : "UPCOMING"
                    }
                    onFilterChange={(newFilterType) => {
                      const newTab = 
                        newFilterType === "UPCOMING" ? "reservations-upcoming"
                        : newFilterType === "PAST" ? "reservations-past"
                        : "reservations-cancelled";
                      setActiveTab(newTab);
                      setProfileRouteState({ mode: "host", tab: newTab });
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Profile;
