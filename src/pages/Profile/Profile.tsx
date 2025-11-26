import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "../../layouts";
import { useAuth } from "../../hooks/useAuth";
import GuestTrips from "./GuestTrips/GuestTrips";
import HostListings from "./HostListings/HostListings";
import HostReservations from "./HostReservations/HostReservations";
import styles from "./Profile.module.css";

type ProfileMode = "guest" | "host";

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "host" ? "host" : "guest";
  const initialTab = searchParams.get("tab") || (initialMode === "host" ? "listings" : "upcoming");
  
  // 호스트 모드에서 "reservations" 탭이 선택되면 기본값을 "reservations-upcoming"으로 설정
  const getInitialTab = () => {
    if (initialMode === "host" && initialTab === "reservations") {
      return "reservations-upcoming";
    }
    return initialTab;
  };
  
  const [mode, setMode] = useState<ProfileMode>(initialMode);
  const [activeTab, setActiveTab] = useState<string>(getInitialTab());

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/");
      return;
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const modeParam = searchParams.get("mode");
    const tabParam = searchParams.get("tab");
    
    if (modeParam === "host") {
      setMode("host");
      // 호스트 모드에서 "reservations" 탭이 선택되면 기본값을 "reservations-upcoming"으로 설정
      // 호스트 모드에서 "listings" 탭이 선택되면 기본값을 "listings-published"로 설정
      if (tabParam === "reservations") {
        setActiveTab("reservations-upcoming");
      } else if (tabParam === "listings") {
        setActiveTab("listings-published");
      } else {
        setActiveTab(tabParam || "listings-published");
      }
    } else {
      setMode("guest");
      setActiveTab(tabParam || "upcoming");
    }
  }, [searchParams]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <MainLayout>
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
                setSearchParams({ mode: "guest", tab: "upcoming" }, { replace: true });
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
                setSearchParams({ mode: "host", tab: "listings" }, { replace: true });
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
                    setSearchParams({ mode: "guest", tab: "upcoming" }, { replace: true });
                  }}
                >
                  다가올 여행
                </button>
                <button
                  className={`${styles.navItem} ${activeTab === "past" ? styles.active : ""}`}
                  onClick={() => {
                    setActiveTab("past");
                    setSearchParams({ mode: "guest", tab: "past" }, { replace: true });
                  }}
                >
                  이전 여행
                </button>
                <button
                  className={`${styles.navItem} ${activeTab === "cancelled" ? styles.active : ""}`}
                  onClick={() => {
                    setActiveTab("cancelled");
                    setSearchParams({ mode: "guest", tab: "cancelled" }, { replace: true });
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
                    setSearchParams({ mode: "host", tab: "listings-published" }, { replace: true });
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
                    setSearchParams({ mode: "host", tab: "reservations-upcoming" }, { replace: true });
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
                      setSearchParams({ mode: "host", tab: newTab }, { replace: true });
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
                      setSearchParams({ mode: "host", tab: newTab }, { replace: true });
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Profile;
