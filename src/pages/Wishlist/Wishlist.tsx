import React from "react";
import { ListContainer } from "../../components/ListContainer";
import { WishlistAccommodationInfo } from "../../types/wishlist";
import { ErrorToast } from "../../components/ErrorToast";
import { WishlistModal } from "../../features/wishlist/components/WishlistModal";
import {
  useWishlistData,
  useWishlistModals,
  useWishlistRouteViewState,
} from "../../features/wishlist";
import {
  formatRecentlyViewedDate,
  groupRecentlyViewedByDate,
} from "../../features/wishlist/lib/recentlyViewedGroups";
import { routeTo } from "../../routes/paths";
import { useIntersectionLoadMore } from "../../hooks/useIntersectionLoadMore";
import { getImageUrl } from "../../utils/image";
import styles from "./Wishlist.module.css";

const Wishlist: React.FC = () => {
  const {
    backToIndex,
    clearSelectedWishlist,
    isEditMode,
    openRecentlyViewed,
    openWishlist,
    selectedWishlist,
    setIsEditMode,
    showRecentlyViewed,
  } = useWishlistRouteViewState();
  const {
    clearError,
    deleteWishlist,
    error,
    hasNext,
    isLoading,
    isLoadingMore,
    isLoadingMoreWishlists,
    loadMoreWishlistAccommodations,
    loadMoreWishlists,
    recentlyViewed,
    refreshRecentlyViewedWishlistState,
    reloadRecentlyViewed,
    removeFromWishlist,
    removeRecentlyViewed,
    saveWishlistAccommodationMemo,
    toggleRecentlyViewedWishlistState,
    wishlistAccommodations,
    wishlists,
    wishlistsHasNext,
  } = useWishlistData({
    selectedWishlistId: selectedWishlist,
    showRecentlyViewed,
  });
  const {
    clearMemoText,
    closeMemoModal,
    closeWishlistModal,
    memoModalOpen,
    memoText,
    openMemoModal,
    openWishlistModal,
    selectedAccommodationForWishlist,
    selectedMemoItem,
    updateMemoText,
    wishlistModalOpen,
  } = useWishlistModals();
  const setWishlistsObserverTarget = useIntersectionLoadMore({
    disabled: Boolean(selectedWishlist || showRecentlyViewed),
    hasNext: wishlistsHasNext,
    isLoading: isLoadingMoreWishlists,
    onLoadMore: loadMoreWishlists,
  });
  const setWishlistAccommodationsObserverTarget = useIntersectionLoadMore({
    disabled: !selectedWishlist || showRecentlyViewed,
    hasNext,
    isLoading: isLoadingMore,
    onLoadMore: loadMoreWishlistAccommodations,
  });

  React.useEffect(() => {
    if (!memoModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMemoModal();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMemoModal, memoModalOpen]);

  const handleRemoveRecentlyViewed = async (accommodationId: number) => {
    await removeRecentlyViewed(accommodationId);
  };

  const handleRecentlyViewedClick = async () => {
    openRecentlyViewed();
    await reloadRecentlyViewed();
  };

  const handleBackClick = () => {
    backToIndex();
  };

  const handleWishlistToggle = async (accommodationId: number) => {
    openWishlistModal(accommodationId);
  };

  const handleWishlistSuccess = () => {
    if (selectedAccommodationForWishlist !== null) {
      toggleRecentlyViewedWishlistState(selectedAccommodationForWishlist);
    }
  };

  const handleRemoveFromWishlist = async (wishlistAccommodationId: number) => {
    await removeFromWishlist(wishlistAccommodationId);
  };

  // 메모 모달 열기
  const handleOpenMemoModal = (item: WishlistAccommodationInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    openMemoModal(item);
  };

  // 메모 저장
  const handleSaveMemo = async () => {
    if (!selectedMemoItem || !memoText.trim()) return;

    const isSaved = await saveWishlistAccommodationMemo(
      selectedMemoItem.wishlist_accommodation_id,
      memoText
    );

    if (isSaved) {
      closeMemoModal();
    }
  };

  // 메모 모두 지우기
  const handleClearMemo = () => {
    clearMemoText();
  };

  const handleDeleteWishlist = async (wishlistId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const isDeleted = await deleteWishlist(wishlistId);
    // 현재 선택된 위시리스트가 삭제된 경우 선택 해제
    if (isDeleted && selectedWishlist === wishlistId) {
      clearSelectedWishlist();
    }
  };

  return (
    <>
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
                {Object.entries(groupRecentlyViewedByDate(recentlyViewed)).map(([date, items]) => (
                  <div key={date} className={styles.dateSection}>
                    <h2 className={styles.dateTitle}>{date}</h2>
                    <div className={styles.recentlyViewedGrid}>
                      {items.map((item) => (
                        <div
                          key={item.accommodation_id}
                          className={styles.recentlyViewedCard}
                          onClick={() =>
                            window.open(routeTo.accommodationDetail(item.accommodation_id), "_blank")
                          }
                        >
                          <div className={styles.recentlyViewedImageWrapper}>
                            {item.thumbnail_url ? (
                              <img
                                src={getImageUrl(item.thumbnail_url)}
                                alt={item.accommodation_name}
                              />
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
                                  handleWishlistToggle(item.accommodation_id);
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
                                {[item.address_summary?.city, item.address_summary?.district].filter(Boolean).join(", ") || item.address_summary?.country || ""}
                              </div>
                              {item.review_summary && item.review_summary.total_count > 0 && (
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
                    </div>
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
                  onClick={backToIndex}
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
                      onClick={() =>
                        window.open(routeTo.accommodationDetail(item.accommodation.id), "_blank")
                      }
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
                      {/* 메모 영역 */}
                      <div 
                        className={styles.memoArea}
                        onClick={(e) => handleOpenMemoModal(item, e)}
                      >
                        {item.memo ? (
                          <span className={styles.memoText}>
                            {item.memo} <span className={styles.memoEdit}>수정</span>
                          </span>
                        ) : (
                          <span className={styles.memoAdd}>메모 추가</span>
                        )}
                      </div>
                    </div>
                  ))}
                </ListContainer>
                {hasNext && (
                  <div ref={setWishlistAccommodationsObserverTarget} className={styles.loadMoreContainer}>
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
                    onClick={() => openWishlist(wishlist.id)}
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
                  <div ref={setWishlistsObserverTarget} className={styles.loadMoreContainer}>
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

        {selectedAccommodationForWishlist !== null && (
          <WishlistModal
            isOpen={wishlistModalOpen}
            onClose={async () => {
              try {
                await refreshRecentlyViewedWishlistState(
                  selectedAccommodationForWishlist
                );
              } catch (err) {
                console.error("위시리스트 상태 확인 실패:", err);
              }
              
              closeWishlistModal();
            }}
            accommodationId={selectedAccommodationForWishlist}
            onSuccess={handleWishlistSuccess}
          />
        )}

        {/* 메모 모달 */}
        {memoModalOpen && (
          <div className={styles.memoModalOverlay} onClick={closeMemoModal}>
            <div className={styles.memoModal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.memoModalHeader}>
                <h3 className={styles.memoModalTitle}>메모 추가</h3>
                <button
                  className={styles.memoModalClose}
                  onClick={closeMemoModal}
                >
                  ✕
                </button>
              </div>
              <div className={styles.memoModalBody}>
                <textarea
                  className={styles.memoTextarea}
                  value={memoText}
                  onChange={(e) => updateMemoText(e.target.value)}
                  placeholder="메모를 입력하세요"
                  maxLength={250}
                />
                <div className={styles.memoCharCount}>{memoText.length}/250자</div>
              </div>
              <div className={styles.memoModalFooter}>
                <button
                  className={styles.memoClearButton}
                  onClick={handleClearMemo}
                >
                  모두 지우기
                </button>
                <button
                  className={styles.memoSaveButton}
                  onClick={handleSaveMemo}
                  disabled={!memoText.trim()}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Wishlist;
