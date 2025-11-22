import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MainLayout } from "../../layouts";
import { ListContainer } from "../../components/ListContainer";
import { AccommodationCardSearch } from "../../components/AccommodationCard";
import { Map } from "../../components/Map";
import { WishlistModal } from "../../components/WishlistModal/WishlistModal";
import { AuthModal } from "../../components/AuthModal/AuthModal";
import { accommodationApi, wishlistApi } from "../../api";
import { AccommodationSearchInfo, AccommodationSearchRequest } from "../../types/accommodation";
import { useApiError } from "../../hooks/useApiError";
import { useAuth } from "../../hooks/useAuth";
import { ErrorToast } from "../../components/ErrorToast";
import styles from "./Search.module.css";

const MAX_PAGE = 15; // 최대 페이지 수 제한

const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { error, handleError, clearError } = useApiError();
  const { isAuthenticated } = useAuth();
  const [accommodations, setAccommodations] = useState<AccommodationSearchInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState<number>(0);
  const [selectedAccommodationId, setSelectedAccommodationId] = useState<number | null>(null);
  const [hoveredAccommodationId, setHoveredAccommodationId] = useState<number | null>(null);
  const [wishlistModalOpen, setWishlistModalOpen] = useState(false);
  const [selectedAccommodationForWishlist, setSelectedAccommodationForWishlist] = useState<number | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isMapDragMode, setIsMapDragMode] = useState(false);
  const isInitialLoadRef = useRef(true);
  const prevPageRef = useRef<number | null>(null);
  const prevSearchParamsRef = useRef<string>("");
  const prevViewportRef = useRef<string | null>(null); // 이전 viewport 정보 추적
  const [shouldUpdateMapBounds, setShouldUpdateMapBounds] = useState(false);

  // 검색 함수
  const fetchAccommodations = async (params: AccommodationSearchRequest, isMapDrag = false) => {
    // 지도 드래그 모드를 먼저 설정하여 accommodations 변경 전에 반영되도록 함
    // 동기적으로 설정하여 Map 컴포넌트의 ref가 즉시 업데이트되도록 함
    if (isMapDrag) {
      setIsMapDragMode(true);
    } else {
      setIsMapDragMode(false);
    }
    
    setIsLoading(true);
    clearError();
    // 지도 드래그가 아닐 때는 page 파라미터를 유지, 지도 드래그일 때만 0으로 리셋
    if (!isMapDrag && params.page !== undefined) {
      setCurrentPage(params.page);
    } else {
      setCurrentPage(0);
    }

    try {
      // 디버깅: API 요청 파라미터 확인
      console.log("🔍 검색 API 요청 파라미터:", {
        viewport: params.topLeftLat ? {
          topLeftLat: params.topLeftLat,
          topLeftLng: params.topLeftLng,
          bottomRightLat: params.bottomRightLat,
          bottomRightLng: params.bottomRightLng,
        } : null,
        destination: params.destination,
        isMapDrag,
        page: params.page,
      });
      
      const response = await accommodationApi.search(params);
      setAccommodations(response.stay_search_result_listing);
      // 최대 페이지 수 제한 (15개)
      const limitedTotalPages = Math.min(response.page_info.total_pages, MAX_PAGE);
      setTotalPages(limitedTotalPages);
      setTotalElements(response.page_info.total_elements);
      // 현재 페이지도 최대 페이지를 초과하지 않도록 제한
      const limitedCurrentPage = Math.min(response.page_info.current_page, limitedTotalPages - 1);
      setCurrentPage(limitedCurrentPage);
      // prevPageRef와 prevSearchParamsRef 업데이트
      prevPageRef.current = limitedCurrentPage;
      prevSearchParamsRef.current = searchParams.toString();
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  };

  // URL 파라미터 기반 초기 검색 및 page 파라미터 변경 감지
  useEffect(() => {
    // 현재 searchParams를 문자열로 변환하여 비교
    const currentSearchParams = searchParams.toString();
    
    // 지도 드래그 모드 여부 확인 (destination이 없고 viewport 파라미터가 있으면 지도 드래그 모드)
    const hasViewportParams = 
      !!searchParams.get("topLeftLat") && 
      !!searchParams.get("topLeftLng");
    const hasDestinationParam = !!searchParams.get("destination");
    const isMapDrag = hasViewportParams && !hasDestinationParam;
    
    // URL에서 page 파라미터 읽기 (0부터 시작, 최대 15로 제한)
    const pageParam = searchParams.get("page");
    const page = pageParam ? Math.min(parseInt(pageParam, 10), MAX_PAGE - 1) : 0;
    
    // page 파라미터만 추출하여 비교 (다른 파라미터 변경은 무시)
    const prevPageParam = prevSearchParamsRef.current ? new URLSearchParams(prevSearchParamsRef.current).get("page") : null;
    const prevPage = prevPageParam ? Math.min(parseInt(prevPageParam, 10), MAX_PAGE - 1) : 0;
    
    // 초기 로드이거나 page 파라미터만 변경된 경우에만 검색 실행
    // 단, 지도 드래그 모드가 아닐 때만 (지도 드래그는 handleMapBoundsChange에서 처리)
    const isPageChanged = prevPageRef.current !== null && prevPageRef.current !== page;
    const isOnlyPageChanged = prevPage !== page && 
      // page 외의 다른 파라미터가 변경되지 않았는지 확인
      (() => {
        const prevParams = new URLSearchParams(prevSearchParamsRef.current);
        const currentParams = new URLSearchParams(currentSearchParams);
        prevParams.delete("page");
        currentParams.delete("page");
        return prevParams.toString() === currentParams.toString();
      })();
    
    // page를 제외한 다른 파라미터가 변경되었는지 확인
    const prevParams = new URLSearchParams(prevSearchParamsRef.current);
    const currentParams = new URLSearchParams(currentSearchParams);
    prevParams.delete("page");
    currentParams.delete("page");
    const isSearchParamsChanged = prevParams.toString() !== currentParams.toString();
    
    // viewport 파라미터 변경 확인
    const prevViewportLat = prevParams.get("topLeftLat");
    const prevViewportLng = prevParams.get("topLeftLng");
    const currentViewportLat = currentParams.get("topLeftLat");
    const currentViewportLng = currentParams.get("topLeftLng");
    const isViewportChanged = 
      (prevViewportLat !== currentViewportLat) ||
      (prevViewportLng !== currentViewportLng) ||
      (prevParams.get("bottomRightLat") !== currentParams.get("bottomRightLat")) ||
      (prevParams.get("bottomRightLng") !== currentParams.get("bottomRightLng"));
    
    // destination 변경 확인
    const prevDestination = prevParams.get("destination");
    const currentDestination = currentParams.get("destination");
    const isDestinationChanged = prevDestination !== currentDestination;
    
    // 지도 드래그 모드: viewport만 변경되고 destination이 없는 경우
    const isMapDragMode = isViewportChanged && !currentParams.get("destination");
    
    // URL에 viewport가 있으면 항상 지도가 해당 viewport로 이동해야 함
    // (뒤로가기, 초기 로드, 검색어 변경 등 모든 경우에 대응)
    const hasViewportForMap = !!searchParams.get("topLeftLat") && !!searchParams.get("topLeftLng");
    const currentViewportString = hasViewportForMap 
      ? `${searchParams.get("topLeftLat")},${searchParams.get("topLeftLng")},${searchParams.get("bottomRightLat")},${searchParams.get("bottomRightLng")}`
      : null;
    
    // URL에 viewport가 있고, viewport가 변경되었을 때 항상 지도 업데이트
    // (뒤로가기 시에도 URL의 viewport 정보를 읽어서 지도를 업데이트)
    if (hasViewportForMap) {
      // viewport가 변경되었거나, 이전과 다른 경우에만 업데이트 (중복 업데이트 방지)
      if (prevViewportRef.current !== currentViewportString) {
        setShouldUpdateMapBounds(true);
        prevViewportRef.current = currentViewportString;
      }
    } else if (!hasViewportForMap) {
      // viewport가 없으면 prevViewportRef 초기화
      prevViewportRef.current = null;
    }
    
    // 검색 실행 조건 단순화:
    // 1. 초기 로드
    // 2. page만 변경된 경우 (다른 파라미터 변경 없음)
    // 3. page 외의 파라미터가 변경된 경우 (검색바에서 검색, 지도 드래그 등)
    // 4. 지도 드래그 모드일 때 viewport 변경 시 (명시적으로 추가)
    const shouldFetch = isInitialLoadRef.current || 
      (isPageChanged && isOnlyPageChanged && !isMapDragMode) ||
      (isSearchParamsChanged) || // page 외의 파라미터 변경 시 항상 검색 실행 (page 변경 여부와 관계없이)
      (isMapDragMode && isViewportChanged); // 지도 드래그 모드일 때 viewport 변경 시 검색 실행
    
    // 디버깅: 검색 실행 여부 확인
    console.log("🔍 검색 실행 조건 확인:", {
      isInitialLoad: isInitialLoadRef.current,
      isPageChanged,
      isOnlyPageChanged,
      isMapDragMode,
      isDestinationChanged,
      isSearchParamsChanged,
      isViewportChanged,
      shouldFetch,
      prevDestination,
      currentDestination,
      prevParams: prevParams.toString(),
      currentParams: currentParams.toString(),
    });
    
    if (!shouldFetch) {
      // page 파라미터가 변경되지 않았거나, 다른 파라미터도 함께 변경된 경우
      prevPageRef.current = page;
      prevSearchParamsRef.current = currentSearchParams;
      return;
    }
    
    // 검색어가 변경되었으면 페이지를 0으로 리셋
    if (isDestinationChanged && !isPageChanged) {
      const resetParams = new URLSearchParams(currentSearchParams);
      resetParams.delete("page");
      if (resetParams.toString() !== currentSearchParams) {
        setSearchParams(resetParams, { replace: true });
        prevPageRef.current = 0;
        prevSearchParamsRef.current = resetParams.toString();
        return; // URL이 업데이트되면 useEffect가 다시 실행됨
      }
    }
    
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
    }
    
    prevPageRef.current = page;
    prevSearchParamsRef.current = currentSearchParams;
    
    // 검색 파라미터 구성
    // 1. viewport가 있으면 viewport 기반 검색 (지도 드래그 모드 또는 선택된 장소의 viewport)
    //    - viewport가 있으면 항상 viewport만 사용하고 destination은 무시 (지도 범위 내 숙소만 검색)
    // 2. viewport가 없고 destination이 있으면 destination 기반 검색
    const hasViewportForSearch = !!searchParams.get("topLeftLat") && !!searchParams.get("topLeftLng");
    const hasDestinationForSearch = !!searchParams.get("destination");
    
    const params: AccommodationSearchRequest = {
      // viewport가 있으면 viewport 기반 검색 (지도 범위 내 숙소 검색)
      // 지도 드래그 시에는 viewport만 사용하고 destination은 무시
      topLeftLat: hasViewportForSearch
        ? parseFloat(searchParams.get("topLeftLat")!)
        : undefined,
      topLeftLng: hasViewportForSearch
        ? parseFloat(searchParams.get("topLeftLng")!)
        : undefined,
      bottomRightLat: hasViewportForSearch
        ? parseFloat(searchParams.get("bottomRightLat")!)
        : undefined,
      bottomRightLng: hasViewportForSearch
        ? parseFloat(searchParams.get("bottomRightLng")!)
        : undefined,
      // viewport가 없을 때만 destination 사용 (viewport가 있으면 destination 무시)
      destination: !hasViewportForSearch && hasDestinationForSearch
        ? searchParams.get("destination") || undefined
        : undefined,
      checkIn: searchParams.get("checkIn") || undefined,
      checkOut: searchParams.get("checkOut") || undefined,
      adultOccupancy: searchParams.get("adultOccupancy")
        ? parseInt(searchParams.get("adultOccupancy")!)
        : undefined,
      childOccupancy: searchParams.get("childOccupancy")
        ? parseInt(searchParams.get("childOccupancy")!)
        : undefined,
      infantOccupancy: searchParams.get("infantOccupancy")
        ? parseInt(searchParams.get("infantOccupancy")!)
        : undefined,
      petOccupancy: searchParams.get("petOccupancy")
        ? parseInt(searchParams.get("petOccupancy")!)
        : undefined,
      page: page,
      size: 18,
    };

    fetchAccommodations(params, isMapDragMode);
  }, [searchParams.toString(), handleError, clearError]);

  // 지도 bounds 변경 핸들러 (지도 드래그/줌 시)
  const handleMapBoundsChange = (bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) => {
    // 디버깅: 지도 bounds 변경 확인
    console.log("🗺️ 지도 bounds 변경:", {
      north: bounds.north,
      south: bounds.south,
      east: bounds.east,
      west: bounds.west,
    });
    
    // URL 파라미터 업데이트
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("topLeftLat", bounds.north.toString());
    newParams.set("topLeftLng", bounds.west.toString());
    newParams.set("bottomRightLat", bounds.south.toString());
    newParams.set("bottomRightLng", bounds.east.toString());
    // 지도 드래그 모드에서는 이전 Google Places 선택 정보 제거
    newParams.delete("destination");
    newParams.delete("lat"); // Google Places 선택 시 설정된 좌표 제거
    newParams.delete("lng"); // Google Places 선택 시 설정된 좌표 제거
    // page 파라미터 제거 (지도 드래그 시 첫 페이지로 리셋)
    newParams.delete("page");
    
    // prevPageRef만 리셋 (prevSearchParamsRef는 useEffect에서 업데이트해야 변경 감지가 됨)
    prevPageRef.current = 0;
    // prevSearchParamsRef는 업데이트하지 않음 (useEffect에서 변경을 감지하기 위해)
    
    // URL 업데이트 (히스토리 추가하지 않음)
    // URL이 변경되면 useEffect에서 검색이 자동으로 실행됨
    setSearchParams(newParams, { replace: true });
  };

  // 페이지 변경 핸들러
  const handlePageChange = async (page: number) => {
    if (page === currentPage || isLoading) return;
    
    // 최대 페이지 수 제한
    if (page >= MAX_PAGE) {
      return;
    }
    
    // 페이지 변경 시 해당 페이지의 숙소들 위/경도에 따라 지도가 바뀌도록 플래그 설정
    setShouldUpdateMapBounds(true);
    
    // URL 파라미터 업데이트
    const newParams = new URLSearchParams(searchParams.toString());
    if (page === 0) {
      newParams.delete("page");
    } else {
      newParams.set("page", page.toString());
    }
    
    // prevPageRef와 prevSearchParamsRef 업데이트 (useEffect에서 중복 검색 방지)
    prevPageRef.current = page;
    prevSearchParamsRef.current = newParams.toString();
    
    // URL 업데이트 (히스토리 추가)
    setSearchParams(newParams, { replace: false });

    setIsLoading(true);
    clearError();

    try {
      // 페이지 변경 시에도 현재 viewport를 유지하여 검색
      const hasViewportForSearch = !!searchParams.get("topLeftLat") && !!searchParams.get("topLeftLng");
      const hasDestinationForSearch = !!searchParams.get("destination");
      
      const params: AccommodationSearchRequest = {
        // viewport가 있으면 viewport 기반 검색 (지도 범위 내 숙소 검색)
        topLeftLat: hasViewportForSearch
          ? parseFloat(searchParams.get("topLeftLat")!)
          : undefined,
        topLeftLng: hasViewportForSearch
          ? parseFloat(searchParams.get("topLeftLng")!)
          : undefined,
        bottomRightLat: hasViewportForSearch
          ? parseFloat(searchParams.get("bottomRightLat")!)
          : undefined,
        bottomRightLng: hasViewportForSearch
          ? parseFloat(searchParams.get("bottomRightLng")!)
          : undefined,
        // viewport가 없을 때만 destination 사용
        destination: !hasViewportForSearch && hasDestinationForSearch
          ? searchParams.get("destination") || undefined
          : undefined,
        checkIn: searchParams.get("checkIn") || undefined,
        checkOut: searchParams.get("checkOut") || undefined,
        adultOccupancy: searchParams.get("adultOccupancy")
          ? parseInt(searchParams.get("adultOccupancy")!)
          : undefined,
        childOccupancy: searchParams.get("childOccupancy")
          ? parseInt(searchParams.get("childOccupancy")!)
          : undefined,
        infantOccupancy: searchParams.get("infantOccupancy")
          ? parseInt(searchParams.get("infantOccupancy")!)
          : undefined,
        petOccupancy: searchParams.get("petOccupancy")
          ? parseInt(searchParams.get("petOccupancy")!)
          : undefined,
        page: page,
        size: 18,
      };

      const response = await accommodationApi.search(params);
      setAccommodations(response.stay_search_result_listing);
      // 최대 페이지 수 제한 (15개)
      const limitedTotalPages = Math.min(response.page_info.total_pages, MAX_PAGE);
      setTotalPages(limitedTotalPages);
      setTotalElements(response.page_info.total_elements);
      // 현재 페이지도 최대 페이지를 초과하지 않도록 제한
      const limitedCurrentPage = Math.min(response.page_info.current_page, limitedTotalPages - 1);
      setCurrentPage(limitedCurrentPage);
      // prevPageRef와 prevSearchParamsRef 업데이트
      prevPageRef.current = limitedCurrentPage;
      prevSearchParamsRef.current = newParams.toString();
      
      // 페이지 상단으로 스크롤
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWishlistToggle = async (accommodationId: number, isInWishlist: boolean) => {
    if (!isAuthenticated) {
      // 로그인 모달 표시
      setAuthModalOpen(true);
      return;
    }

    if (isInWishlist) {
      // 위시리스트 모달 열기 (삭제를 위해)
      setSelectedAccommodationForWishlist(accommodationId);
      setWishlistModalOpen(true);
    } else {
      // 위시리스트 모달 열기
      setSelectedAccommodationForWishlist(accommodationId);
      setWishlistModalOpen(true);
    }
  };

  const handleWishlistSuccess = () => {
    // onSuccess는 모달 내부에서 호출되지만, 모달이 닫힐 때 onClose에서 상태를 업데이트하므로
    // 여기서는 특별한 처리가 필요 없음
  };

  const handleAccommodationSelect = (accommodation: AccommodationSearchInfo | null) => {
    if (accommodation) {
      setSelectedAccommodationId(accommodation.id);
      // 해당 숙소로 스크롤 (선택사항)
      const element = document.getElementById(`accommodation-${accommodation.id}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else {
      setSelectedAccommodationId(null);
    }
  };

  const handleAccommodationCardClick = (accommodationId: number) => {
    // 새 탭에서 열기
    window.open(`/accommodations/${accommodationId}`, '_blank');
    setSelectedAccommodationId(accommodationId);
  };

  return (
    <MainLayout>
      <div className={styles.container}>
        <main className={`${styles.main} ${isMapExpanded ? styles.mapExpanded : ''}`}>
          <div className={styles.results}>
              <h2 className={styles.title}>
                {totalElements >= 1000 
                  ? "숙소 1,000개 이상" 
                  : `숙소 ${totalElements.toLocaleString()}개`}
              </h2>
              {isLoading && accommodations.length === 0 ? (
                <div className={styles.loading}>로딩 중...</div>
              ) : accommodations.length === 0 ? (
                <div className={styles.empty}>검색 결과가 없습니다.</div>
              ) : (
                <>
                  <ListContainer columns={3} gap={10}>
                    {accommodations.map((accommodation) => (
                      <div
                        key={accommodation.id}
                        id={`accommodation-${accommodation.id}`}
                        onMouseEnter={() => setHoveredAccommodationId(accommodation.id)}
                        onMouseLeave={() => setHoveredAccommodationId(null)}
                        className={`${styles.cardWrapper} ${
                          selectedAccommodationId === accommodation.id ? styles.selected : ""
                        }`}
                      >
                        <AccommodationCardSearch
                          accommodation={accommodation}
                          onClick={() => handleAccommodationCardClick(accommodation.id)}
                          onWishlistToggle={() =>
                            handleWishlistToggle(accommodation.id, accommodation.is_in_wishlist)
                          }
                          checkIn={searchParams.get("checkIn")}
                          checkOut={searchParams.get("checkOut")}
                        />
                      </div>
                    ))}
                  </ListContainer>
                  {totalPages > 1 && (
                    <div className={styles.paginationContainer}>
                      <div className={styles.pagination}>
                        <button
                          className={styles.paginationButton}
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 0 || isLoading}
                        >
                          이전
                        </button>
                        {(() => {
                          const pages: (number | string)[] = [];
                          const maxDisplayPages = Math.min(totalPages, MAX_PAGE);
                          
                          // 페이지 번호 생성 로직
                          if (maxDisplayPages <= 7) {
                            // 전체 페이지가 7개 이하면 모두 표시
                            for (let i = 0; i < maxDisplayPages; i++) {
                              pages.push(i);
                            }
                          } else {
                            // 첫 페이지
                            pages.push(0);
                            
                            if (currentPage <= 3) {
                              // 현재 페이지가 앞쪽에 있으면
                              for (let i = 1; i <= 4; i++) {
                                pages.push(i);
                              }
                              pages.push("ellipsis");
                              pages.push(maxDisplayPages - 1);
                            } else if (currentPage >= maxDisplayPages - 4) {
                              // 현재 페이지가 뒤쪽에 있으면
                              pages.push("ellipsis");
                              for (let i = maxDisplayPages - 5; i < maxDisplayPages - 1; i++) {
                                pages.push(i);
                              }
                              pages.push(maxDisplayPages - 1);
                            } else {
                              // 현재 페이지가 중간에 있으면
                              pages.push("ellipsis");
                              for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                                pages.push(i);
                              }
                              pages.push("ellipsis");
                              pages.push(maxDisplayPages - 1);
                            }
                          }
                          
                          return pages.map((page, index) => {
                            if (page === "ellipsis") {
                              return (
                                <span key={`ellipsis-${index}`} className={styles.paginationEllipsis}>
                                  ...
                                </span>
                              );
                            }
                            const pageNum = page as number;
                            return (
                              <button
                                key={pageNum}
                                className={`${styles.paginationButton} ${
                                  pageNum === currentPage ? styles.paginationButtonActive : ""
                                }`}
                                onClick={() => handlePageChange(pageNum)}
                                disabled={isLoading}
                              >
                                {pageNum + 1}
                              </button>
                            );
                          });
                        })()}
                        <button
                          className={styles.paginationButton}
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage >= Math.min(totalPages, MAX_PAGE) - 1 || isLoading}
                        >
                          다음
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
          </div>
          <div className={styles.mapSection}>
            <Map
              accommodations={accommodations}
              selectedAccommodationId={selectedAccommodationId}
              hoveredAccommodationId={hoveredAccommodationId}
              onAccommodationSelect={handleAccommodationSelect}
              onWishlistToggle={handleWishlistToggle}
              checkIn={searchParams.get("checkIn")}
              checkOut={searchParams.get("checkOut")}
              isExpanded={isMapExpanded}
              onExpandToggle={() => setIsMapExpanded(!isMapExpanded)}
              onBoundsChange={handleMapBoundsChange}
              isMapDragMode={isMapDragMode}
              shouldUpdateMapBounds={shouldUpdateMapBounds}
              onMapBoundsUpdated={() => {
                setShouldUpdateMapBounds(false);
              }}
              viewport={
                searchParams.get("topLeftLat") && searchParams.get("topLeftLng")
                  ? {
                      north: parseFloat(searchParams.get("topLeftLat")!),
                      south: parseFloat(searchParams.get("bottomRightLat")!),
                      east: parseFloat(searchParams.get("bottomRightLng")!),
                      west: parseFloat(searchParams.get("topLeftLng")!),
                    }
                  : null
              }
            />
          </div>
        </main>

        {error && (
          <div className={styles.toastContainer}>
            <ErrorToast message={error} onClose={clearError} />
          </div>
        )}
      </div>

      {selectedAccommodationForWishlist && (
        <WishlistModal
          isOpen={wishlistModalOpen}
          onClose={async () => {
            // 모달이 닫힐 때 위시리스트 상태 확인하여 검색 결과 업데이트
            try {
              const response = await wishlistApi.getWishlists({
                size: 20,
                accommodationId: selectedAccommodationForWishlist,
              });
              const isInAnyWishlist = response.data?.wishlists.some(w => w.is_contained) || false;
              
              // 검색 결과의 위시리스트 상태 업데이트
              setAccommodations((prev) =>
                prev.map((acc) =>
                  acc.id === selectedAccommodationForWishlist
                    ? { ...acc, is_in_wishlist: isInAnyWishlist }
                    : acc
                )
              );
            } catch (err) {
              // 에러가 발생해도 모달은 닫기
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
    </MainLayout>
  );
};

export default Search;
