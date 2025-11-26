import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "../../layouts";
import { ListContainer } from "../../components/ListContainer";
import { BaseAccommodationCard } from "../../components/AccommodationCard";
import { AccommodationMeta } from "../../components/AccommodationCard";
import { wishlistApi, recentlyViewedApi } from "../../api";
import {
  WishlistInfo,
  WishlistAccommodationInfo,
} from "../../types/wishlist";
import { RecentlyViewedAccommodationInfo } from "../../types/recentlyViewed";
import { useApiError } from "../../hooks/useApiError";
import { useAuth } from "../../hooks/useAuth";
import { ErrorToast } from "../../components/ErrorToast";
import { AuthModal } from "../../components/AuthModal/AuthModal";
import { WishlistModal } from "../../components/WishlistModal";
import { getImageUrl } from "../../utils/image";
import baseStyles from "../../components/AccommodationCard/BaseAccommodationCard.module.css";
import styles from "./Wishlist.module.css";

const Wishlist: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { error, handleError, clearError } = useApiError();
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedAccommodationInfo[]>([]);
  const [wishlists, setWishlists] = useState<WishlistInfo[]>([]);
  const [selectedWishlist, setSelectedWishlist] = useState<number | null>(null);
  const [showRecentlyViewed, setShowRecentlyViewed] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [wishlistAccommodations, setWishlistAccommodations] = useState<
    WishlistAccommodationInfo[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [wishlistsCursor, setWishlistsCursor] = useState<string | null>(null);
  const [wishlistsHasNext, setWishlistsHasNext] = useState(false);
  const [isLoadingMoreWishlists, setIsLoadingMoreWishlists] = useState(false);
  const wishlistsObserverTarget = useRef<HTMLDivElement>(null);
  const wishlistAccommodationsObserverTarget = useRef<HTMLDivElement>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [wishlistModalOpen, setWishlistModalOpen] = useState(false);
  const [selectedAccommodationForWishlist, setSelectedAccommodationForWishlist] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/");
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      clearError();

      try {
        // 최근 조회 목록
        const recentlyViewedResponse = await recentlyViewedApi.getRecentlyViewed();
        setRecentlyViewed(recentlyViewedResponse?.accommodations || []);

        // 위시리스트 목록
        const wishlistsResponse = await wishlistApi.getWishlists({ size: 20 });
        setWishlists(wishlistsResponse?.wishlists || []);
        setWishlistsCursor(wishlistsResponse?.page_info?.next_cursor || null);
        setWishlistsHasNext(wishlistsResponse?.page_info?.has_next || false);
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, navigate, handleError, clearError]);

  useEffect(() => {
    if (!selectedWishlist || showRecentlyViewed) {
      setWishlistAccommodations([]);
      setCursor(null);
      setHasNext(false);
      return;
    }

    const fetchWishlistAccommodations = async () => {
      setIsLoading(true);
      clearError();

      try {
        const response = await wishlistApi.getWishlistAccommodations(selectedWishlist, {
          size: 20,
        });
        setWishlistAccommodations(response?.wishlist_accommodations || []);
        setCursor(response?.page_info?.next_cursor || null);
        setHasNext(response?.page_info?.has_next || false);
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWishlistAccommodations();
  }, [selectedWishlist, showRecentlyViewed, handleError, clearError]);

  const handleLoadMoreWishlistAccommodations = useCallback(async () => {
    if (!selectedWishlist || !hasNext || isLoadingMore || !cursor) return;

    setIsLoadingMore(true);
    clearError();

    try {
      const response = await wishlistApi.getWishlistAccommodations(selectedWishlist, {
        size: 20,
        cursor,
      });
      setWishlistAccommodations((prev) => [
        ...prev,
        ...(response?.wishlist_accommodations || []),
      ]);
      setCursor(response?.page_info?.next_cursor || null);
      setHasNext(response?.page_info?.has_next || false);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [selectedWishlist, hasNext, isLoadingMore, cursor, clearError, handleError]);

  const handleLoadMoreWishlists = useCallback(async () => {
    if (!wishlistsHasNext || isLoadingMoreWishlists || !wishlistsCursor) return;

    setIsLoadingMoreWishlists(true);
    clearError();

    try {
      const response = await wishlistApi.getWishlists({ size: 20, cursor: wishlistsCursor });
      setWishlists((prev) => [...prev, ...(response?.wishlists || [])]);
      setWishlistsCursor(response?.page_info?.next_cursor || null);
      setWishlistsHasNext(response.page_info?.has_next || false);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoadingMoreWishlists(false);
    }
  }, [wishlistsHasNext, isLoadingMoreWishlists, wishlistsCursor, clearError, handleError]);

  // 위시리스트 목록 무한 스크롤
  useEffect(() => {
    if (selectedWishlist || showRecentlyViewed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && wishlistsHasNext && !isLoadingMoreWishlists) {
          handleLoadMoreWishlists();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = wishlistsObserverTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [wishlistsHasNext, isLoadingMoreWishlists, handleLoadMoreWishlists, selectedWishlist, showRecentlyViewed]);

  // 위시리스트 상세 무한 스크롤
  useEffect(() => {
    if (!selectedWishlist || showRecentlyViewed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNext && !isLoadingMore) {
          handleLoadMoreWishlistAccommodations();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = wishlistAccommodationsObserverTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasNext, isLoadingMore, handleLoadMoreWishlistAccommodations, selectedWishlist, showRecentlyViewed]);

  const handleRemoveRecentlyViewed = async (accommodationId: number) => {
    try {
      await recentlyViewedApi.remove(accommodationId);
      setRecentlyViewed((prev) =>
        prev.filter((item) => item.accommodation_id !== accommodationId)
      );
    } catch (err) {
      handleError(err);
    }
  };

  const handleRecentlyViewedClick = async () => {
    setShowRecentlyViewed(true);
    setSelectedWishlist(null);
    setIsEditMode(false);
    
    // 최근 조회 목록 최신 데이터 조회
    setIsLoading(true);
    clearError();
    try {
      const response = await recentlyViewedApi.getRecentlyViewed();
      setRecentlyViewed(response?.accommodations || []);
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackClick = () => {
    setShowRecentlyViewed(false);
    setSelectedWishlist(null);
    setIsEditMode(false);
  };

  const handleWishlistToggle = async (accommodationId: number, isInWishlist: boolean) => {
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }

    setSelectedAccommodationForWishlist(accommodationId);
    setWishlistModalOpen(true);
  };

  const handleWishlistSuccess = () => {
    // 최근 조회 목록의 위시리스트 상태 업데이트
    setRecentlyViewed((prev) =>
      prev.map((item) =>
        item.accommodation_id === selectedAccommodationForWishlist
          ? { ...item, is_in_wishlist: !item.is_in_wishlist }
          : item
      )
    );
  };

  const handleRemoveFromWishlist = async (wishlistAccommodationId: number) => {
    try {
      await wishlistApi.removeAccommodation(wishlistAccommodationId);
      setWishlistAccommodations((prev) =>
        prev.filter((item) => item.wishlist_accommodation_id !== wishlistAccommodationId)
      );
    } catch (err) {
      handleError(err);
    }
  };

  const handleDeleteWishlist = async (wishlistId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await wishlistApi.delete(wishlistId);
      setWishlists((prev) => prev.filter((w) => w.id !== wishlistId));
      // 현재 선택된 위시리스트가 삭제된 경우 선택 해제
      if (selectedWishlist === wishlistId) {
        setSelectedWishlist(null);
      }
    } catch (err) {
      handleError(err);
    }
  };

  // 최근 조회 날짜 포맷팅 (어제, 오늘 등)
  const formatRecentlyViewedDate = (viewedAt: string): string => {
    const viewedDate = new Date(viewedAt);
    const now = new Date();
    const diffTime = now.getTime() - viewedDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "오늘";
    } else if (diffDays === 1) {
      return "어제";
    } else if (diffDays < 7) {
      return `${diffDays}일 전`;
    } else {
      return viewedDate.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  };

  const groupByDate = (items: RecentlyViewedAccommodationInfo[]) => {
    const groups: { [key: string]: RecentlyViewedAccommodationInfo[] } = {};
    items.forEach((item) => {
      const date = formatRecentlyViewedDate(item.viewed_at);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(item);
    });
    return groups;
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <MainLayout>
      <div className={styles.container}>
        {showRecentlyViewed ? (
          /* 최근 조회 상세 페이지 */
          <>
            <div className={styles.recentlyViewedHeader}>
              <div className={styles.recentlyViewedHeaderLeft}>
                <button className={styles.backButton} onClick={handleBackClick}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
                <h1 className={styles.recentlyViewedTitle}>최근 조회</h1>
              </div>
              {recentlyViewed.length > 0 && (
                <button
                  className={styles.editButton}
                  onClick={() => setIsEditMode(!isEditMode)}
                >
                  {isEditMode ? "완료" : "수정"}
                </button>
              )}
            </div>
            {recentlyViewed.length === 0 ? (
              <div className={styles.empty}>최근 조회한 숙소가 없습니다.</div>
            ) : (
              <>
                {Object.entries(groupByDate(recentlyViewed)).map(([date, items]) => (
                  <div key={date} className={styles.dateSection}>
                    <h2 className={styles.dateTitle}>{date}</h2>
                    <ListContainer columns={4} gap={40}>
                      {items.map((item) => (
                        <div
                          key={item.accommodation_id}
                          className={styles.accommodationCard}
                          onClick={() => navigate(`/accommodations/${item.accommodation_id}`)}
                        >
                          <div className={styles.wishlistCardImage}>
                            {item.thumbnail_url ? (
                              <>
                                <img
                                  src={getImageUrl(item.thumbnail_url)}
                                  alt={item.accommodation_name}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = "none";
                                    const placeholder = target.nextElementSibling as HTMLElement;
                                    if (placeholder && placeholder.classList.contains(styles.placeholderImage)) {
                                      placeholder.style.display = "flex";
                                    }
                                  }}
                                />
                                <div className={styles.placeholderImage} style={{ display: "none" }}>이미지 없음</div>
                              </>
                            ) : (
                              <div className={styles.placeholderImage}>이미지 없음</div>
                            )}
                            {/* 수정 모드: 삭제 버튼 (왼쪽 상단) */}
                            {isEditMode && (
                              <button
                                className={styles.deleteButtonLeft}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveRecentlyViewed(item.accommodation_id);
                                }}
                                aria-label="삭제"
                              >
                                ✕
                              </button>
                            )}
                            {/* 수정 모드가 아닐 때: 위시리스트 버튼 (오른쪽 상단) */}
                            {!isEditMode && (
                              <button
                                className={`${styles.wishlistButton} ${
                                  item.is_in_wishlist ? styles.wishlistActive : ""
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleWishlistToggle(item.accommodation_id, item.is_in_wishlist);
                                }}
                                aria-label="위시리스트"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  fill={item.is_in_wishlist ? "#ff385c" : "none"}
                                  stroke={item.is_in_wishlist ? "#ffffff" : "#222222"}
                                  strokeWidth="1.5"
                                >
                                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <div className={styles.wishlistCardInfo}>
                            <div className={styles.locationRow}>
                              <div className={styles.location}>
                                {[item.address_summary.city, item.address_summary.district].filter(Boolean).join(", ") || item.address_summary.country}
                              </div>
                              {item.review_summary.total_count > 0 && (
                                <div className={styles.review}>
                                  <span className={styles.star}>★</span>
                                  <span className={styles.rating}>{item.review_summary.average_rating.toFixed(1)}</span>
                                  <span className={styles.reviewCount}>({item.review_summary.total_count})</span>
                                </div>
                              )}
                            </div>
                            <div className={styles.name}>{item.accommodation_name}</div>
                          </div>
                        </div>
                      ))}
                    </ListContainer>
                  </div>
                ))}
              </>
            )}
          </>
        ) : selectedWishlist ? (
          /* 위시리스트 상세 페이지 */
          <>
            <div className={styles.recentlyViewedHeader}>
              <div className={styles.recentlyViewedHeaderLeft}>
                <button
                  className={styles.backButton}
                  onClick={() => {
                    setSelectedWishlist(null);
                    setIsEditMode(false);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </button>
                <h1 className={styles.recentlyViewedTitle}>
                  {wishlists.find((w) => w.id === selectedWishlist)?.name}
                </h1>
              </div>
            </div>
            {isLoading ? (
              <div className={styles.loading}>로딩 중...</div>
            ) : wishlistAccommodations.length === 0 ? (
              <div className={styles.empty}>위시리스트가 비어있습니다.</div>
            ) : (
              <>
                <ListContainer columns={4} gap={40}>
                  {wishlistAccommodations.map((item) => (
                    <div
                      key={item.wishlist_accommodation_id}
                      className={styles.accommodationCard}
                      onClick={() => navigate(`/accommodations/${item.accommodation.id}`)}
                      onMouseEnter={(e) => {
                        const deleteBtn = e.currentTarget.querySelector(
                          `.${styles.deleteButton}`
                        ) as HTMLElement;
                        if (deleteBtn) deleteBtn.style.opacity = "1";
                      }}
                      onMouseLeave={(e) => {
                        const deleteBtn = e.currentTarget.querySelector(
                          `.${styles.deleteButton}`
                        ) as HTMLElement;
                        if (deleteBtn) deleteBtn.style.opacity = "0";
                      }}
                    >
                      <div className={styles.wishlistCardImage}>
                        {item.accommodation.thumbnail_url ? (
                          <>
                            <img
                              src={getImageUrl(item.accommodation.thumbnail_url)}
                              alt={item.accommodation.name}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = "none";
                                const placeholder = target.nextElementSibling as HTMLElement;
                                if (placeholder && placeholder.classList.contains(styles.placeholderImage)) {
                                  placeholder.style.display = "flex";
                                }
                              }}
                            />
                            <div className={styles.placeholderImage} style={{ display: "none" }}>이미지 없음</div>
                          </>
                        ) : (
                          <div className={styles.placeholderImage}>이미지 없음</div>
                        )}
                        <button
                          className={styles.deleteButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFromWishlist(item.wishlist_accommodation_id);
                          }}
                          aria-label="삭제"
                        >
                          ✕
                        </button>
                      </div>
                      <div className={styles.wishlistCardInfo}>
                        <div className={styles.locationRow}>
                          <div className={styles.location}>
                            {[item.address_summary.city, item.address_summary.district].filter(Boolean).join(", ") || item.address_summary.country}
                          </div>
                          {item.review_summary.total_count > 0 && (
                            <div className={styles.review}>
                              <span className={styles.star}>★</span>
                              <span className={styles.rating}>{item.review_summary.average_rating.toFixed(1)}</span>
                              <span className={styles.reviewCount}>({item.review_summary.total_count})</span>
                            </div>
                          )}
                        </div>
                        <div className={styles.name}>{item.accommodation.name}</div>
                      </div>
                    </div>
                  ))}
                </ListContainer>
                {hasNext && (
                  <div ref={wishlistAccommodationsObserverTarget} className={styles.loadMoreContainer}>
                    {isLoadingMore && (
                      <div className={styles.loadingMore}>로딩 중...</div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          /* 위시리스트 그리드 페이지 */
          <>
            <h1 className={styles.pageTitle}>위시리스트</h1>
            {isLoading && recentlyViewed.length === 0 && wishlists.length === 0 ? (
              <div className={styles.loading}>로딩 중...</div>
            ) : (
              <div className={styles.wishlistGrid}>
                {/* 최근 조회 항목 (항상 첫 번째) */}
                <div
                  className={styles.wishlistCard}
                  onClick={handleRecentlyViewedClick}
                >
                  <div className={styles.wishlistCardImage}>
                    <div className={styles.searchIcon}>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                    </div>
                  </div>
                  <div className={styles.wishlistCardInfo}>
                    <div className={styles.wishlistCardName}>최근 조회</div>
                    <div className={styles.wishlistCardCount}>
                      {recentlyViewed.length > 0
                        ? formatRecentlyViewedDate(recentlyViewed[0].viewed_at)
                        : "항목 없음"}
                    </div>
                  </div>
                </div>

                {/* 위시리스트 목록 */}
                {wishlists.map((wishlist) => (
                  <div
                    key={wishlist.id}
                    className={styles.wishlistCard}
                    onClick={() => setSelectedWishlist(wishlist.id)}
                    onMouseEnter={(e) => {
                      const deleteBtn = e.currentTarget.querySelector(
                        `.${styles.wishlistDeleteButton}`
                      ) as HTMLElement;
                      if (deleteBtn) deleteBtn.style.opacity = "1";
                    }}
                    onMouseLeave={(e) => {
                      const deleteBtn = e.currentTarget.querySelector(
                        `.${styles.wishlistDeleteButton}`
                      ) as HTMLElement;
                      if (deleteBtn) deleteBtn.style.opacity = "0";
                    }}
                  >
                    <div className={styles.wishlistCardImage}>
                      {wishlist.thumbnail_image_url ? (
                        <img
                          src={getImageUrl(wishlist.thumbnail_image_url)}
                          alt={wishlist.name}
                        />
                      ) : (
                        <div className={styles.placeholderImage}>
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                        </div>
                      )}
                      {/* 위시리스트 삭제 버튼 (왼쪽 상단) */}
                      <button
                        className={styles.wishlistDeleteButton}
                        onClick={(e) => handleDeleteWishlist(wishlist.id, e)}
                        aria-label="위시리스트 삭제"
                      >
                        ✕
                      </button>
                    </div>
                    <div className={styles.wishlistCardInfo}>
                      <div className={styles.wishlistCardName}>{wishlist.name}</div>
                      <div className={styles.wishlistCardCount}>
                        저장된 항목 {wishlist.wishlist_item_count}개
                      </div>
                    </div>
                  </div>
                ))}
                {wishlistsHasNext && (
                  <div ref={wishlistsObserverTarget} className={styles.loadMoreContainer}>
                    {isLoadingMoreWishlists && (
                      <div className={styles.loadingMore}>로딩 중...</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {error && (
          <div className={styles.toastContainer}>
            <ErrorToast message={error} onClose={clearError} />
          </div>
        )}

        {selectedAccommodationForWishlist && (
          <WishlistModal
            isOpen={wishlistModalOpen}
            onClose={async () => {
              try {
                const response = await wishlistApi.getWishlists({
                  size: 20,
                  accommodationId: selectedAccommodationForWishlist,
                });
                const isInAnyWishlist = response?.wishlists?.some((w) => w.is_contained) || false;
                
                setRecentlyViewed((prev) =>
                  prev.map((acc) =>
                    acc.accommodation_id === selectedAccommodationForWishlist
                      ? { ...acc, is_in_wishlist: isInAnyWishlist }
                      : acc
                  )
                );
              } catch (err) {
                console.error("위시리스트 상태 확인 실패:", err);
              }
              
              setWishlistModalOpen(false);
              setSelectedAccommodationForWishlist(null);
            }}
            accommodationId={selectedAccommodationForWishlist}
            onSuccess={handleWishlistSuccess}
          />
        )}

        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialMode="login"
        />
      </div>
    </MainLayout>
  );
};

export default Wishlist;
