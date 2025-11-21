import React, { useState, useEffect, useRef, useCallback } from "react";
import { wishlistApi } from "../../api/wishlist";
import { WishlistInfo } from "../../types/wishlist";
import { useApiError } from "../../hooks/useApiError";
import { getImageUrl } from "../../utils/image";
import { CreateWishlistModal } from "../CreateWishlistModal/CreateWishlistModal";
import styles from "./WishlistModal.module.css";

interface WishlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  accommodationId: number;
  onSuccess?: () => void;
}

export const WishlistModal: React.FC<WishlistModalProps> = ({
  isOpen,
  onClose,
  accommodationId,
  onSuccess,
}) => {
  const [wishlists, setWishlists] = useState<WishlistInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { error, handleError, clearError } = useApiError();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  // 위시리스트 목록 조회
  const fetchWishlists = useCallback(
    async (cursor?: string | null) => {
      setIsLoading(true);
      clearError();

      try {
        const response = await wishlistApi.getWishlists({
          size: 20,
          cursor: cursor || undefined,
          accommodationId: accommodationId,
        });

        if (response.data) {
          if (cursor) {
            // 추가 로드
            setWishlists((prev) => [...prev, ...response.data!.wishlists]);
          } else {
            // 초기 로드
            setWishlists(response.data.wishlists);
          }

          setHasNext(response.data.page_info.has_next);
          setNextCursor(response.data.page_info.next_cursor || null);
        }
      } catch (err) {
        handleError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [handleError, clearError, accommodationId]
  );

  // 초기 로드
  useEffect(() => {
    if (isOpen) {
      fetchWishlists();
    } else {
      // 모달이 닫힐 때 상태 초기화
      setWishlists([]);
      setHasNext(false);
      setNextCursor(null);
      clearError();
    }
  }, [isOpen, fetchWishlists, clearError]);

  // 무한스크롤 설정
  useEffect(() => {
    if (!isOpen || !hasNext || isLoading) {
      // observer 정리
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNext && nextCursor && !isLoading) {
          fetchWishlists(nextCursor);
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [isOpen, hasNext, nextCursor, isLoading, fetchWishlists]);

  // 위시리스트에 숙소 추가/삭제
  const handleWishlistClick = async (wishlist: WishlistInfo, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    try {
      if (wishlist.is_contained && wishlist.wishlist_accommodation_id) {
        // 위시리스트에서 삭제
        await wishlistApi.removeAccommodation(wishlist.wishlist_accommodation_id);
        // 목록 새로고침하여 삭제 반영
        await fetchWishlists();
        // onSuccess 콜백 호출
        if (onSuccess) {
          onSuccess();
        }
        // 모달은 닫지 않고 유지
      } else {
        // 위시리스트에 추가
        await wishlistApi.addAccommodation(wishlist.id, {
          accommodation_id: accommodationId,
        });
        // 목록 새로고침하여 추가 반영
        await fetchWishlists();
        // onSuccess 콜백 호출
        if (onSuccess) {
          onSuccess();
        }
        // 모달은 닫지 않고 유지
      }
    } catch (err) {
      handleError(err);
    }
  };

  // 새 위시리스트 생성 후 목록 새로고침
  const handleCreateSuccess = async (newWishlistId: number) => {
    setShowCreateModal(false);
    // 새로 생성된 위시리스트에 바로 추가
    try {
      await wishlistApi.addAccommodation(newWishlistId, {
        accommodation_id: accommodationId,
      });
      // 목록 새로고침하여 새로 추가된 위시리스트 반영
      await fetchWishlists();
      // onSuccess 콜백 호출
      if (onSuccess) {
        onSuccess();
      }
      // 모달은 닫지 않고 유지
    } catch (err) {
      handleError(err);
    }
  };

  // 모달이 열릴 때 body 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.modal}>
        <button className={styles.closeButton} onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>

        <div className={styles.content}>
          <h2 className={styles.title}>위시리스트에 저장하기</h2>

          <div className={styles.wishlistGrid} ref={scrollContainerRef}>
            {wishlists.map((wishlist) => (
              <div
                key={wishlist.id}
                className={styles.wishlistItem}
                onClick={(e) => handleWishlistClick(wishlist, e)}
              >
                <div className={styles.wishlistImage}>
                  {wishlist.thumbnail_image_url ? (
                    <>
                      <img
                        src={getImageUrl(wishlist.thumbnail_image_url)}
                        alt={wishlist.name}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          const placeholder = target.nextElementSibling as HTMLElement;
                          if (placeholder && placeholder.classList.contains(styles.placeholderImage)) {
                            placeholder.style.display = "flex";
                          }
                        }}
                      />
                      <div className={styles.placeholderImage} style={{ display: "none" }}>
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      </div>
                    </>
                  ) : (
                    <div className={styles.placeholderImage}>
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </div>
                  )}
                  <div
                    className={`${styles.wishlistIcon} ${
                      wishlist.is_contained ? styles.active : ""
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill={wishlist.is_contained ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </div>
                </div>
                <div className={styles.wishlistInfo}>
                  <div className={styles.wishlistName}>{wishlist.name}</div>
                  <div className={styles.wishlistCount}>
                    저장된 항목 {wishlist.wishlist_item_count}개
                  </div>
                </div>
              </div>
            ))}
            <div ref={loadingRef} className={styles.loadingIndicator}>
              {hasNext && isLoading && "로딩 중..."}
            </div>
          </div>

          <button
            className={styles.createButton}
            onClick={() => setShowCreateModal(true)}
          >
            새로운 위시리스트 만들기
          </button>
        </div>
      </div>

      <CreateWishlistModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
    </>
  );
};

