import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AccommodationSearchInfo } from "../../types/accommodation";
import { getImageUrl } from "../../utils/image";
import styles from "./Map.module.css";

interface MapProps {
  accommodations: AccommodationSearchInfo[];
  selectedAccommodationId: number | null;
  hoveredAccommodationId?: number | null;
  onAccommodationSelect: (accommodation: AccommodationSearchInfo | null) => void;
  onWishlistToggle?: (accommodationId: number, isInWishlist: boolean) => void;
  checkIn?: string | null;
  checkOut?: string | null;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
  onBoundsChange?: (bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) => void;
  isMapDragMode?: boolean;
  shouldUpdateMapBounds?: boolean;
  onMapBoundsUpdated?: () => void;
  viewport?: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
}

export const Map: React.FC<MapProps> = ({
  accommodations,
  selectedAccommodationId,
  hoveredAccommodationId,
  onAccommodationSelect,
  onWishlistToggle,
  checkIn,
  checkOut,
  isExpanded = false,
  onExpandToggle,
  onBoundsChange,
  isMapDragMode = false,
  shouldUpdateMapBounds = false,
  onMapBoundsUpdated,
  viewport,
}) => {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const scriptLoadedRef = useRef(false);
  const prevSelectedIdRef = useRef<number | null>(null);
  const prevHoveredIdRef = useRef<number | null>(null);
  const boundsInitializedRef = useRef(false);
  const hoveredAccommodationIdRef = useRef<number | null>(null);
  const isMapDragModeRef = useRef(isMapDragMode);
  const onAccommodationSelectRef = useRef(onAccommodationSelect);
  const boundsChangeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const idleListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const isInitialIdleRef = useRef(true);
  const previousBoundsRef = useRef<{ north: number; south: number; east: number; west: number } | null>(null);
  const [isLoadingBounds, setIsLoadingBounds] = useState(false);
  const prevViewportRef = useRef<{ north: number; south: number; east: number; west: number } | null>(null);
  const viewportJustChangedRef = useRef(false);
  const prevAccommodationsRef = useRef<AccommodationSearchInfo[]>([]);
  
  // onAccommodationSelect ref 업데이트
  useEffect(() => {
    onAccommodationSelectRef.current = onAccommodationSelect;
  }, [onAccommodationSelect]);

  // Google Maps API가 완전히 로드되었는지 확인하는 함수
  const checkMapsLoaded = (): boolean => {
    return !!(
      window.google &&
      window.google.maps &&
      window.google.maps.Map &&
      typeof window.google.maps.Map === 'function'
    );
  };

  // Google Maps API 동적 로드
  useEffect(() => {
    if (scriptLoadedRef.current) return;

    // 이미 로드되어 있는지 확인
    if (checkMapsLoaded()) {
      setIsMapLoaded(true);
      return;
    }

    // 스크립트가 이미 추가되어 있는지 확인
    const existingScript = document.querySelector(
      'script[src*="maps.googleapis.com"]'
    );
    if (existingScript) {
      const checkLoaded = setInterval(() => {
        if (checkMapsLoaded()) {
          setIsMapLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 100);
      return () => clearInterval(checkLoaded);
    }

    // Google Maps API 스크립트 로드
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    console.log("Google Maps API Key:", apiKey ? "설정됨" : "설정되지 않음");
    if (apiKey) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // onload 후에도 Map 생성자가 사용 가능할 때까지 대기
        const checkInterval = setInterval(() => {
          if (checkMapsLoaded()) {
            setIsMapLoaded(true);
            clearInterval(checkInterval);
          }
        }, 50);
        
        // 최대 5초 대기
        setTimeout(() => {
          clearInterval(checkInterval);
          if (!checkMapsLoaded()) {
            console.error("Google Maps API Map 생성자를 사용할 수 없습니다.");
          }
        }, 5000);
      };
      script.onerror = () => {
        console.error("Google Maps API 로드 실패");
      };
      document.head.appendChild(script);
      scriptLoadedRef.current = true;
    } else {
      console.warn("Google Maps API 키가 설정되지 않았습니다. REACT_APP_GOOGLE_MAPS_API_KEY 환경 변수를 설정하고 개발 서버를 재시작해주세요.");
    }
  }, []);

  // 지도 초기화
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return;
    
    // 지도가 이미 초기화되었으면 재초기화하지 않음 (한국으로 돌아가는 것 방지)
    if (mapInstanceRef.current) {
      return;
    }

    const initMap = () => {
      if (!mapRef.current || !checkMapsLoaded()) {
        console.warn("Google Maps API가 아직 완전히 로드되지 않았습니다.");
        return;
      }

      // 기본 중심점 (한국) - 초기 로드 시에만 사용
      const defaultCenter = { lat: 37.5665, lng: 126.9780 };

      // 지도 생성
      const mapOptions: google.maps.MapOptions = {
        center: defaultCenter,
        zoom: 7,
        mapTypeControl: false,
        fullscreenControl: false, // 기본 전체 화면 컨트롤 비활성화 (커스텀 버튼 사용)
        streetViewControl: false,
        zoomControl: true,
      };

      // ControlPosition이 사용 가능한 경우에만 zoomControlOptions 추가
      if (window.google?.maps?.ControlPosition) {
        mapOptions.zoomControlOptions = {
          position: window.google.maps.ControlPosition.RIGHT_CENTER,
        };
      }

      try {
        const map = new window.google.maps.Map(mapRef.current, mapOptions);

        mapInstanceRef.current = map;

        // 지도 확장/축소 버튼 추가 (지도가 로드된 후)
        setTimeout(() => {
          if (!mapRef.current || !onExpandToggle) return;

          // 기존 버튼이 있으면 제거
          const existingButton = mapRef.current.querySelector('.map-expand-button');
          if (existingButton) {
            existingButton.remove();
          }

          // 확장/축소 버튼 생성
          const expandButton = document.createElement('button');
          expandButton.className = 'map-expand-button';
          expandButton.innerHTML = isExpanded
            ? `
              <svg viewBox="0 0 24 24" fill="currentColor" style="width: 20px; height: 20px;">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
              </svg>
            `
            : `
              <svg viewBox="0 0 24 24" fill="currentColor" style="width: 20px; height: 20px;">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
              </svg>
            `;
          expandButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            width: 40px;
            height: 40px;
            background: white;
            border: none;
            border-radius: 2px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
            cursor: pointer;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #222222;
            transition: background-color 0.2s ease;
          `;
          
          expandButton.addEventListener('mouseenter', () => {
            expandButton.style.backgroundColor = '#f7f7f7';
          });
          expandButton.addEventListener('mouseleave', () => {
            expandButton.style.backgroundColor = 'white';
          });

          expandButton.addEventListener('click', (e) => {
            e.stopPropagation();
            onExpandToggle();
          });
          
          // 지도 컨테이너에 버튼 추가
          mapRef.current.appendChild(expandButton);
        }, 500);

        // 지도 클릭 시 InfoWindow 닫기
        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          // 마커 클릭이 아닌 경우에만 InfoWindow 닫기
          if (infoWindowRef.current) {
            infoWindowRef.current.close();
            onAccommodationSelectRef.current(null);
          }
        });

        // idle 리스너는 별도 useEffect에서 설정 (지도 재초기화 방지)
      } catch (error) {
        console.error("지도 초기화 실패:", error);
        return undefined;
      }
    };

    const cleanup = initMap();
    return cleanup;
  }, [isMapLoaded]); // onBoundsChange와 isMapDragMode 제거하여 재초기화 방지

  // isMapDragMode ref 업데이트
  useEffect(() => {
    isMapDragModeRef.current = isMapDragMode;
    // 지도와 검색 결과를 완전히 분리: boundsInitializedRef를 절대 리셋하지 않음
    // 지도 위치는 사용자가 설정한 위치 그대로 유지
  }, [isMapDragMode]);

  // onBoundsChange 변경 시 idle 리스너만 업데이트 (지도 재초기화 방지)
  useEffect(() => {
    // 지도가 초기화되지 않았으면 리스너 설정하지 않음
    if (!mapInstanceRef.current || !onBoundsChange) return;
    
    const mapInstance = mapInstanceRef.current;

    // 기존 리스너 제거
    if (idleListenerRef.current) {
      google.maps.event.removeListener(idleListenerRef.current);
      idleListenerRef.current = null;
    }
    
    // 기존 타이머 제거
    if (boundsChangeTimerRef.current) {
      clearTimeout(boundsChangeTimerRef.current);
      boundsChangeTimerRef.current = null;
    }
    
    const handleIdle = () => {
      // 초기 idle 이벤트는 무시 (지도 초기화나 마커 fitBounds로 인한 것)
      if (isInitialIdleRef.current) {
        isInitialIdleRef.current = false;
        // 현재 bounds를 저장
        if (mapInstance.getBounds()) {
          const bounds = mapInstance.getBounds()!;
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          previousBoundsRef.current = {
            north: ne.lat(),
            south: sw.lat(),
            east: ne.lng(),
            west: sw.lng(),
          };
        }
        return;
      }
      
      // 기존 타이머가 있으면 클리어
      if (boundsChangeTimerRef.current) {
        clearTimeout(boundsChangeTimerRef.current);
        boundsChangeTimerRef.current = null;
      }
      
      // 로딩 시작
      setIsLoadingBounds(true);
      
      // 3초 후에 bounds 변경 콜백 호출
      boundsChangeTimerRef.current = setTimeout(() => {
        setIsLoadingBounds(false);
        
        if (onBoundsChange && mapInstance.getBounds()) {
          const bounds = mapInstance.getBounds()!;
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          
          const newBounds = {
            north: ne.lat(),
            south: sw.lat(),
            east: ne.lng(),
            west: sw.lng(),
          };
          
          // 이전 bounds와 비교하여 실제로 변경되었는지 확인
          const prev = previousBoundsRef.current;
          if (prev) {
            const threshold = 0.001; // 약 100m 차이
            const hasChanged = 
              Math.abs(prev.north - newBounds.north) > threshold ||
              Math.abs(prev.south - newBounds.south) > threshold ||
              Math.abs(prev.east - newBounds.east) > threshold ||
              Math.abs(prev.west - newBounds.west) > threshold;
            
            if (!hasChanged) {
              // bounds가 실제로 변경되지 않았으면 콜백 호출하지 않음
              setIsLoadingBounds(false);
              return;
            }
          }
          
          // bounds가 실제로 변경되었으면 콜백 호출
          previousBoundsRef.current = newBounds;
          onBoundsChange(newBounds);
        }
      }, 3000);
    };

    // idle 이벤트 리스너 추가 (드래그, 줌 완료 시)
    idleListenerRef.current = mapInstance.addListener("idle", handleIdle);

    // cleanup 함수
    return () => {
      if (boundsChangeTimerRef.current) {
        clearTimeout(boundsChangeTimerRef.current);
        boundsChangeTimerRef.current = null;
      }
      if (idleListenerRef.current) {
        google.maps.event.removeListener(idleListenerRef.current);
        idleListenerRef.current = null;
      }
      setIsLoadingBounds(false);
    };
  }, [onBoundsChange]);

  // 마커 생성 및 업데이트 (accommodations가 실제로 변경될 때만)
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return;

    const map = mapInstanceRef.current;

    // isMapDragModeRef를 즉시 업데이트 (prop 변경 시)
    isMapDragModeRef.current = isMapDragMode;

    // 기존 마커 ID 추출
    const existingIds = new Set(markersRef.current.map(m => (m as any).accommodationId));
    const newIds = new Set(accommodations.map(acc => acc.id));
    
    // accommodations가 실제로 변경되었는지 확인
    const hasChanged = 
      existingIds.size !== newIds.size ||
      !Array.from(existingIds).every(id => newIds.has(id)) ||
      !Array.from(newIds).every(id => existingIds.has(id));

    if (!hasChanged && markersRef.current.length > 0) {
      // 변경되지 않았으면 마커 재생성하지 않음
      return;
    }

    // 기존 마커 제거
    markersRef.current.forEach((marker) => {
      marker.setMap(null);
    });
    markersRef.current = [];

    // InfoWindow 닫기
    if (infoWindowRef.current) {
      infoWindowRef.current.close();
    }
    
    // 지도와 검색 결과를 완전히 분리: 지도 위치는 절대 변경하지 않음
    // 한 번 초기화되면 boundsInitializedRef를 절대 리셋하지 않음
    // accommodations가 변경되어도 지도 위치는 유지 (마커만 업데이트)
    if (!boundsInitializedRef.current) {
      // 아직 초기화되지 않은 경우에만 false로 설정 (초기 로드 시에만 fitBounds 호출)
      boundsInitializedRef.current = false;
    }
    // 이미 초기화된 경우에는 boundsInitializedRef를 true로 유지하여 fitBounds가 호출되지 않도록 함

    // 유효한 좌표를 가진 숙소만 필터링
    const validAccommodations = accommodations.filter(
      (acc) =>
        acc.coordinate.latitude !== null &&
        acc.coordinate.longitude !== null
    );

    if (validAccommodations.length === 0) return;

    // 모든 마커의 경계 계산
    const bounds = new window.google.maps.LatLngBounds();

    // 마커 생성
    validAccommodations.forEach((accommodation) => {
      const lat = accommodation.coordinate.latitude!;
      const lng = accommodation.coordinate.longitude!;

      // 가격 버블을 위한 커스텀 아이콘 생성 (초기 생성 시에는 선택/호버 상태 반영 안 함)
      const priceText = accommodation.price_per_night.price;
      
      // 텍스트 길이에 맞춰 버블 너비 계산 (대략적인 계산)
      const textWidth = priceText.length * 8 + 20; // 문자당 8px + 여유 20px
      const bubbleWidth = Math.max(textWidth, 60); // 최소 60px
      const bubbleHeight = 28;
      const padding = 12; // 좌우 패딩
      const totalWidth = bubbleWidth + padding * 2;
      
      // SVG를 사용한 가격 버블 아이콘
      const svgIcon = `
        <svg width="${totalWidth}" height="${bubbleHeight}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <style>
              .price-bubble {
                fill: #ffffff;
                stroke: #dddddd;
                stroke-width: 1;
              }
              .price-text {
                fill: #222222;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                font-size: 14px;
                font-weight: 600;
              }
            </style>
          </defs>
          <rect class="price-bubble" x="0" y="0" width="${totalWidth}" height="${bubbleHeight}" rx="14" ry="14"/>
          <text class="price-text" x="${totalWidth / 2}" y="${bubbleHeight / 2 + 4}" text-anchor="middle" dominant-baseline="middle">${priceText}</text>
        </svg>
      `;

      // SVG를 Data URL로 변환
      const svgBlob = new Blob([svgIcon], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        title: accommodation.name,
        icon: {
          url: svgUrl,
          scaledSize: new window.google.maps.Size(totalWidth, bubbleHeight),
          anchor: new window.google.maps.Point(totalWidth / 2, bubbleHeight),
        },
      });

      // 마커에 accommodation 정보 저장
      (marker as any).accommodationId = accommodation.id;
      (marker as any).accommodation = accommodation;
      
      // 선택됨 상태 아이콘 미리 생성
      const selectedSvgIcon = `
        <svg width="${totalWidth}" height="${bubbleHeight}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <style>
              .price-bubble {
                fill: #222222;
                stroke: #222222;
                stroke-width: 2;
              }
              .price-text {
                fill: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                font-size: 14px;
                font-weight: 600;
              }
            </style>
          </defs>
          <rect class="price-bubble" x="0" y="0" width="${totalWidth}" height="${bubbleHeight}" rx="14" ry="14"/>
          <text class="price-text" x="${totalWidth / 2}" y="${bubbleHeight / 2 + 4}" text-anchor="middle" dominant-baseline="middle">${priceText}</text>
        </svg>
      `;
      const selectedSvgBlob = new Blob([selectedSvgIcon], { type: 'image/svg+xml' });
      const selectedSvgUrl = URL.createObjectURL(selectedSvgBlob);
      
      // 호버됨 상태 아이콘 미리 생성
      const hoveredSvgIcon = `
        <svg width="${totalWidth}" height="${bubbleHeight}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <style>
              .price-bubble {
                fill: #222222;
                stroke: #222222;
                stroke-width: 2;
              }
              .price-text {
                fill: #ffffff;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                font-size: 14px;
                font-weight: 600;
              }
            </style>
          </defs>
          <rect class="price-bubble" x="0" y="0" width="${totalWidth}" height="${bubbleHeight}" rx="14" ry="14"/>
          <text class="price-text" x="${totalWidth / 2}" y="${bubbleHeight / 2 + 4}" text-anchor="middle" dominant-baseline="middle">${priceText}</text>
        </svg>
      `;
      const hoveredSvgBlob = new Blob([hoveredSvgIcon], { type: 'image/svg+xml' });
      const hoveredSvgUrl = URL.createObjectURL(hoveredSvgBlob);
      
      const iconSize = new window.google.maps.Size(totalWidth, bubbleHeight);
      const iconAnchor = new window.google.maps.Point(totalWidth / 2, bubbleHeight);
      
      // 모든 상태의 아이콘을 미리 생성하여 저장
      (marker as any).icons = {
        default: {
          url: svgUrl,
          scaledSize: iconSize,
          anchor: iconAnchor,
        },
        selected: {
          url: selectedSvgUrl,
          scaledSize: iconSize,
          anchor: iconAnchor,
        },
        hovered: {
          url: hoveredSvgUrl,
          scaledSize: iconSize,
          anchor: iconAnchor,
        },
      };
      (marker as any).originalIcon = (marker as any).icons.default;

      // 마커 호버 효과 (부드러운 애니메이션)
      let animationFrameId: number | null = null;
      let currentScale = 1.0;
      const targetScale = 1.1;
      const animationDuration = 200; // 200ms
      const startTime = Date.now();
      
      const animateScale = (startScale: number, endScale: number, startTime: number) => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);
        
        // easing function (ease-out)
        const easeOut = 1 - Math.pow(1 - progress, 3);
        currentScale = startScale + (endScale - startScale) * easeOut;
        
        const originalIcon = (marker as any).originalIcon;
        if (originalIcon && originalIcon.scaledSize) {
          marker.setIcon({
            url: originalIcon.url,
            scaledSize: new window.google.maps.Size(
              originalIcon.scaledSize.width * currentScale,
              originalIcon.scaledSize.height * currentScale
            ),
            anchor: new window.google.maps.Point(
              (originalIcon.scaledSize.width * currentScale) / 2,
              originalIcon.scaledSize.height * currentScale
            ),
          });
        }
        
        if (progress < 1) {
          animationFrameId = requestAnimationFrame(() => animateScale(startScale, endScale, startTime));
        }
      };
      
      marker.addListener("mouseover", () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        const startScale = currentScale;
        animateScale(startScale, targetScale, Date.now());
      });

      marker.addListener("mouseout", () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        const startScale = currentScale;
        animateScale(startScale, 1.0, Date.now());
      });

      // 마커 클릭 이벤트 (InfoWindow는 selectedAccommodationId 변경 시 useEffect에서 처리)
      marker.addListener("click", (e: google.maps.MapMouseEvent) => {
        // 이벤트 전파 방지 (지도 클릭 이벤트가 발생하지 않도록)
        if (e.domEvent) {
          e.domEvent.stopPropagation();
        }
        onAccommodationSelect(accommodation);
      });

      markersRef.current.push(marker);
      bounds.extend({ lat, lng });
    });

    // 요구사항에 따른 지도 위치 업데이트 로직
    // 1단계: 검색어 선택 시 viewport로 강제 이동 (초기 위치 잡기, Google Places 선택 시에만)
    // 2단계: 백엔드로부터 숙소를 받아온 직후 → 숙소 기반 fitBounds (항상 수행)
    // 3단계: 페이지 이동 시에도 해당 페이지 숙소들로 fitBounds
    // 단, 지도 드래그 모드일 때는 사용자가 직접 지도를 움직이는 것이므로 fitBounds를 수행하지 않음
    
    // 1단계: viewport가 제공되었고 변경되었으면 강제 이동 (검색어 선택 시, 초기 위치 잡기)
    // 지도 드래그 모드가 아닐 때만 수행 (지도 드래그 모드는 사용자가 직접 지도를 움직이는 것이므로)
    if (viewport && !isMapDragMode) {
      const viewportChanged = 
        !prevViewportRef.current ||
        prevViewportRef.current.north !== viewport.north ||
        prevViewportRef.current.south !== viewport.south ||
        prevViewportRef.current.east !== viewport.east ||
        prevViewportRef.current.west !== viewport.west;
      
      if (viewportChanged) {
        isInitialIdleRef.current = true;
        const viewportBounds = new window.google.maps.LatLngBounds(
          { lat: viewport.south, lng: viewport.west },
          { lat: viewport.north, lng: viewport.east }
        );
        map.fitBounds(viewportBounds, 50);
        prevViewportRef.current = viewport;
        viewportJustChangedRef.current = true; // viewport로 이동했음을 표시
        // 숙소가 로드되면 2단계에서 숙소 기반 fitBounds를 수행해야 함
      }
    }
    
    // accommodations 변경 감지
    const accommodationsChanged = 
      prevAccommodationsRef.current.length !== validAccommodations.length ||
      prevAccommodationsRef.current.some((acc, idx) => 
        acc.id !== validAccommodations[idx]?.id
      );
    
    // 2단계 & 3단계: 숙소가 있으면 항상 숙소 기반 fitBounds 수행
    // (검색 결과를 받은 직후 또는 페이지 변경 시)
    // 단, 지도 드래그 모드가 아닐 때만 수행 (지도 드래그 모드는 사용자가 직접 지도를 움직이는 것이므로)
    if (validAccommodations.length > 0 && !isMapDragMode) {
      // viewport로 이동한 직후이거나, 페이지 변경 시, 또는 초기 로드 시, 또는 accommodations가 변경되었을 때
      const shouldFitBounds = 
        viewportJustChangedRef.current || // viewport로 이동한 직후 (숙소가 로드되면 fitBounds)
        shouldUpdateMapBounds || // 페이지 변경 시
        !boundsInitializedRef.current || // 초기 로드 시
        accommodationsChanged; // accommodations가 변경되었을 때 (검색 결과를 받은 직후 또는 페이지 변경)
      
      if (shouldFitBounds) {
        isInitialIdleRef.current = true;
        
        if (validAccommodations.length > 1) {
          // 숙소들을 모두 포함하는 최소 bounding box로 fitBounds (padding 50px)
          map.fitBounds(bounds, 50);
        } else if (validAccommodations.length === 1) {
          // 숙소가 1개인 경우 center와 zoom 설정
          const firstAccommodation = validAccommodations[0];
          map.setCenter({
            lat: firstAccommodation.coordinate.latitude!,
            lng: firstAccommodation.coordinate.longitude!,
          });
          map.setZoom(12);
        }
        boundsInitializedRef.current = true;
        viewportJustChangedRef.current = false; // fitBounds 완료
        prevAccommodationsRef.current = [...validAccommodations]; // accommodations 변경 추적
        
        // 지도 bounds 업데이트 완료 알림
        if (onMapBoundsUpdated) {
          onMapBoundsUpdated();
        }
        return;
      }
    }
    
    // accommodations 변경 추적 업데이트 (fitBounds를 수행하지 않았어도)
    if (accommodationsChanged) {
      prevAccommodationsRef.current = [...validAccommodations];
    }
    
    // 그 외의 경우(스크롤, 검색 결과 변경 등)에는 fitBounds를 호출하지 않음
    // 지도 위치는 사용자가 설정한 위치 그대로 유지
  }, [accommodations, isMapDragMode, shouldUpdateMapBounds, onMapBoundsUpdated, viewport]);

  // 선택된 숙소로 지도 이동 (지도 확대/축소 제거: 지도 크기는 항상 모든 숙소를 보여주는 크기로 유지)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const currentSelectedId = selectedAccommodationId;
    const prevSelectedId = prevSelectedIdRef.current;
    
    // 이전에 선택되었던 마커를 원래 색상으로 복원
    if (prevSelectedId !== null && prevSelectedId !== currentSelectedId) {
      const prevMarker = markersRef.current.find((marker) => {
        const markerAccommodationId = (marker as any).accommodationId;
        return markerAccommodationId === prevSelectedId;
      });
      
      if (prevMarker) {
        const icons = (prevMarker as any).icons;
        const isHovered = hoveredAccommodationId === prevSelectedId;
        // 호버 상태면 호버 아이콘, 아니면 기본 아이콘
        prevMarker.setIcon(isHovered ? icons.hovered : icons.default);
      }
    }

    // 현재 선택된 마커를 검은색으로 표시
    if (currentSelectedId) {
      const selectedAccommodation = accommodations.find(
        (acc) => acc.id === selectedAccommodationId
      );

      if (
        !selectedAccommodation ||
        selectedAccommodation.coordinate.latitude === null ||
        selectedAccommodation.coordinate.longitude === null
      ) {
        return;
      }

      // 선택된 마커만 강조 (미리 생성된 아이콘 사용)
      const targetMarker = markersRef.current.find((marker) => {
        const markerAccommodationId = (marker as any).accommodationId;
        return markerAccommodationId === selectedAccommodation.id;
      });
      
      if (targetMarker) {
        const icons = (targetMarker as any).icons;
        // 선택된 마커는 항상 selected 아이콘 사용 (호버 상태 무관)
        targetMarker.setIcon(icons.selected);
      }
      
      // 모든 마커를 확인하여 selected 마커가 항상 selected 아이콘을 유지하도록 보장
      // (다른 useEffect에서 변경될 수 있으므로)
      setTimeout(() => {
        if (selectedAccommodationId === selectedAccommodation.id) {
          const marker = markersRef.current.find((m) => {
            const markerAccommodationId = (m as any).accommodationId;
            return markerAccommodationId === selectedAccommodation.id;
          });
          if (marker) {
            const icons = (marker as any).icons;
            marker.setIcon(icons.selected);
          }
        }
      }, 0);

      // InfoWindow 표시
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }

      const selectedMarker = markersRef.current.find((marker) => {
        const markerAccommodationId = (marker as any).accommodationId;
        return markerAccommodationId === selectedAccommodation.id;
      });

      if (selectedMarker) {
      const thumbnailUrl = selectedAccommodation.accommodation_thumbnail_url
        ? getImageUrl(selectedAccommodation.accommodation_thumbnail_url)
        : null;

      const wishlistIconColor = selectedAccommodation.is_in_wishlist ? "#ff385c" : "#222222";
      const wishlistIconFill = selectedAccommodation.is_in_wishlist ? "currentColor" : "none";

      // 날짜 차이 계산 (박수)
      const calculateNights = (checkIn: string | null | undefined, checkOut: string | null | undefined): number => {
        if (!checkIn || !checkOut) return 1;
        
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        const diffTime = checkOutDate.getTime() - checkInDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays > 0 ? diffDays : 1;
      };

      // 가격에서 숫자만 추출
      const extractPriceNumber = (priceString: string): number => {
        const numberString = priceString.replace(/[^\d]/g, '');
        return parseInt(numberString, 10) || 0;
      };

      // 총 가격 계산 및 포맷팅
      const formatTotalPrice = (pricePerNight: string, nights: number): string => {
        const priceNumber = extractPriceNumber(pricePerNight);
        const totalPrice = priceNumber * nights;
        return `₩${totalPrice.toLocaleString()}`;
      };

      const nights = calculateNights(checkIn, checkOut);
      const hasDates = checkIn && checkOut;
      
      // 가격 표시
      let priceDisplay = '';
      if (hasDates) {
        const totalPrice = formatTotalPrice(selectedAccommodation.price_per_night.price, nights);
        priceDisplay = `<span>${totalPrice}</span><span style="font-size: 14px; font-weight: 400; color: #717171;"> ${nights}박</span>`;
      } else {
        priceDisplay = `<span>${selectedAccommodation.price_per_night.price}</span><span style="font-size: 14px; font-weight: 400; color: #717171;"> 1박</span>`;
      }

      // 리뷰 표시 (리뷰 수가 0이면 표시하지 않음)
      const reviewDisplay = selectedAccommodation.review.total_count > 0 
        ? `<div style="display: flex; align-items: center; gap: 4px; margin-left: 8px; flex-shrink: 0;">
            <span style="font-size: 14px; color: #222222;">★</span>
            <span style="font-size: 14px; color: #222222; font-weight: 600;">${selectedAccommodation.review.average_rating.toFixed(1)}</span>
            <span style="font-size: 14px; color: #717171;">(${selectedAccommodation.review.total_count})</span>
          </div>`
        : '';

      // InfoWindow 생성 시 꼬리 제거를 위한 옵션 설정
      const infoWindow = new window.google.maps.InfoWindow({
        disableAutoPan: true,
        content: `
          <div id="info-window-${selectedAccommodation.id}" style="width: 327px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,0.18); background: white; margin: 0; padding: 0; cursor: pointer; display: flex; flex-direction: column;">
            <div style="position: relative; width: 327px; height: 211.94px; overflow: hidden; background-color: #f7f7f7;">
              ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="${selectedAccommodation.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
              <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; background-color: #f7f7f7; color: #717171; font-size: 14px;">이미지 없음</div>` : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background-color: #f7f7f7; color: #717171; font-size: 14px;">이미지 없음</div>`}
              <div style="position: absolute; top: 12px; right: 12px; display: flex; gap: 8px; z-index: 10;">
                ${onWishlistToggle ? `
                  <button onclick="event.stopPropagation(); window.toggleWishlist && window.toggleWishlist(${selectedAccommodation.id}, ${selectedAccommodation.is_in_wishlist})" style="width: 28px; height: 28px; border-radius: 50%; border: none; background: rgba(255, 255, 255, 0.95); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; box-shadow: 0 1px 2px rgba(0,0,0,0.08);">
                    <svg viewBox="0 0 24 24" fill="${wishlistIconFill}" stroke="${wishlistIconColor}" stroke-width="1.5" style="width: 16px; height: 16px; color: ${wishlistIconColor};">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>
                ` : ''}
                <button onclick="event.stopPropagation(); window.closeInfoWindow && window.closeInfoWindow()" style="width: 30px; height: 30px; border-radius: 50%; border: none; background: rgba(255, 255, 255, 0.95); cursor: pointer; display: flex; align-items: center; justify-content: center; color: #222222; font-size: 20px; line-height: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.08);">×</button>
              </div>
            </div>
            <div style="width: 327px; padding: 12px 12px 12px 12px; background: white; box-sizing: border-box; display: flex; flex-direction: column;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
                <p style="margin: 0; font-size: 14px; color: #222222; font-weight: 600; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${selectedAccommodation.location_summary}</p>
                ${reviewDisplay}
              </div>
              <h3 style="margin: 0 0 2px 0; font-size: 14px; font-weight: 400; color: #222222; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${selectedAccommodation.name}</h3>
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #222222;">
                ${priceDisplay}
              </p>
            </div>
          </div>
        `,
      });
      
      // InfoWindow 클릭 이벤트 추가 및 스타일 오버라이드
      infoWindow.addListener('domready', () => {
        // InfoWindow 위치를 간단하게 조정 (화면 밖으로 나가는 경우에만)
        const mapDiv = mapRef.current;
        
        if (!mapDiv) {
          return;
        }
        
        // InfoWindow DOM 요소 찾기
        setTimeout(() => {
          const infoWindowContainer = document.querySelector('.gm-style-iw-c') as HTMLElement;
          if (!infoWindowContainer) {
            return;
          }
          
          const infoWindowParent = infoWindowContainer.parentElement;
          if (!infoWindowParent) {
            return;
          }
          
          const mapRect = mapDiv.getBoundingClientRect();
          const infoWindowRect = infoWindowContainer.getBoundingClientRect();
          
          const infoWindowWidth = 327;
          const infoWindowHeight = infoWindowRect.height; // 실제 높이 사용
          const margin = 20;
          
          // InfoWindow의 현재 위치 (지도 컨테이너 기준)
          const infoWindowLeft = infoWindowRect.left - mapRect.left;
          const infoWindowTop = infoWindowRect.top - mapRect.top;
          const infoWindowRight = infoWindowLeft + infoWindowWidth;
          const infoWindowBottom = infoWindowTop + infoWindowHeight;
          
          const mapWidth = mapRect.width;
          const mapHeight = mapRect.height;
          
          let adjustX = 0;
          let adjustY = 0;
          
          // 화면 밖으로 나가는 경우에만 조정
          if (infoWindowLeft < margin) {
            adjustX = margin - infoWindowLeft;
          } else if (infoWindowRight > mapWidth - margin) {
            adjustX = (mapWidth - margin) - infoWindowRight;
          }
          
          if (infoWindowTop < margin) {
            adjustY = margin - infoWindowTop;
          } else if (infoWindowBottom > mapHeight - margin) {
            adjustY = (mapHeight - margin) - infoWindowBottom;
          }
          
          // 위치 조정 적용
          if (adjustX !== 0 || adjustY !== 0) {
            const currentTransform = infoWindowParent.style.transform || '';
            const translateMatch = currentTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
            const currentX = translateMatch ? parseFloat(translateMatch[1]) : 0;
            const currentY = translateMatch ? parseFloat(translateMatch[2]) : 0;
            
            infoWindowParent.style.transform = `translate(${currentX + adjustX}px, ${currentY + adjustY}px)`;
          }
        }, 50);
        
        const infoWindowElement = document.getElementById(`info-window-${selectedAccommodation.id}`);
        if (infoWindowElement) {
          infoWindowElement.addEventListener('click', (e) => {
            // 버튼 클릭이 아닌 경우에만 네비게이션
            const target = e.target as HTMLElement;
            if (!target.closest('button')) {
              // 새 탭에서 열기
              window.open(`/accommodations/${selectedAccommodation.id}`, '_blank');
            }
          });
        }
        
        // InfoWindow 스타일 오버라이드
        const infoWindowD = document.querySelector('.gm-style-iw-d') as HTMLElement;
        if (infoWindowD) {
          infoWindowD.style.padding = '0';
          infoWindowD.style.background = 'transparent';
          infoWindowD.style.boxShadow = 'none';
        }
        const infoWindowC = document.querySelector('.gm-style-iw-c') as HTMLElement;
        if (infoWindowC) {
          infoWindowC.style.padding = '0';
          infoWindowC.style.background = 'transparent';
          infoWindowC.style.boxShadow = 'none';
          infoWindowC.style.borderRadius = '12px';
          infoWindowC.style.overflow = 'hidden';
        }
        
        // Google Maps 기본 닫기 버튼 영역 완전히 제거
        // .gm-ui-hover-effect는 닫기 버튼
        // .gm-style-iw-chr, .gm-style-iw-ch는 닫기 버튼을 감싸는 컨테이너
        const closeButtonContainer = document.querySelector('.gm-style-iw-chr') as HTMLElement;
        if (closeButtonContainer) {
          closeButtonContainer.remove();
        }
        const closeButton = document.querySelector('.gm-ui-hover-effect') as HTMLElement;
        if (closeButton) {
          closeButton.remove();
        }
        // 추가로 닫기 버튼을 감싸는 다른 요소들도 제거
        const closeButtonWrapper = document.querySelector('.gm-style-iw-ch') as HTMLElement;
        if (closeButtonWrapper && closeButtonWrapper.children.length === 0) {
          closeButtonWrapper.remove();
        }
        
        // InfoWindow 꼬리 부분의 가상 요소만 제거 (CSS로 처리)
        // JavaScript로 조작하지 않고 CSS만 사용하여 InfoWindow에 영향 없게 처리
      });

      // 위시리스트 토글 함수 등록
      if (onWishlistToggle) {
        (window as any).toggleWishlist = (accommodationId: number, isInWishlist: boolean) => {
          onWishlistToggle(accommodationId, isInWishlist);
          // InfoWindow 닫기
          if (infoWindowRef.current) {
            infoWindowRef.current.close();
          }
        };
      }

      // InfoWindow 닫기 함수 등록
      (window as any).closeInfoWindow = () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.close();
          // InfoWindow가 닫히면 선택 상태 해제
          onAccommodationSelect(null as any);
        }
      };
      
      // InfoWindow가 닫힐 때 이벤트 리스너 추가
      infoWindow.addListener("closeclick", () => {
        // 마커 색상을 호버 상태에 따라 복원
        if (selectedMarker) {
          const icons = (selectedMarker as any).icons;
          const isHovered = hoveredAccommodationIdRef.current === selectedAccommodation.id;
          selectedMarker.setIcon(isHovered ? icons.hovered : icons.default);
        }
        onAccommodationSelect(null as any);
      });
      
      // InfoWindow가 닫힐 때 이벤트 리스너 추가 (다른 방법으로 닫힐 때도 처리)
      infoWindow.addListener("close", () => {
        // 마커 색상을 호버 상태에 따라 복원
        if (selectedMarker) {
          const icons = (selectedMarker as any).icons;
          const isHovered = hoveredAccommodationIdRef.current === selectedAccommodation.id;
          selectedMarker.setIcon(isHovered ? icons.hovered : icons.default);
        }
        // InfoWindow가 닫힐 때 선택 상태 해제하여 마커 색상 복원
        onAccommodationSelect(null as any);
        
        // 리스너 제거
        if ((infoWindow as any)._resizeListener) {
          google.maps.event.removeListener((infoWindow as any)._resizeListener);
          (infoWindow as any)._resizeListener = null;
        }
      });

      // InfoWindow 열기
      infoWindow.open(mapInstanceRef.current, selectedMarker);
      infoWindowRef.current = infoWindow;
      
      // 지도 크기 변경 시 InfoWindow 위치 재조정 (전체 화면 모드 대응)
      const adjustInfoWindowPosition = () => {
        if (!infoWindowRef.current || !mapRef.current) {
          return;
        }
        
        setTimeout(() => {
          const infoWindowContainer = document.querySelector('.gm-style-iw-c') as HTMLElement;
          if (!infoWindowContainer) {
            return;
          }
          
          const infoWindowParent = infoWindowContainer.parentElement;
          if (!infoWindowParent) {
            return;
          }
          
          const mapDiv = mapRef.current;
          if (!mapDiv) {
            return;
          }
          
          const mapRect = mapDiv.getBoundingClientRect();
          const infoWindowRect = infoWindowContainer.getBoundingClientRect();
          
          const infoWindowWidth = 327;
          const infoWindowHeight = infoWindowRect.height; // 실제 높이 사용
          const margin = 20;
          
          const infoWindowLeft = infoWindowRect.left - mapRect.left;
          const infoWindowTop = infoWindowRect.top - mapRect.top;
          const infoWindowRight = infoWindowLeft + infoWindowWidth;
          const infoWindowBottom = infoWindowTop + infoWindowHeight;
          
          const mapWidth = mapRect.width;
          const mapHeight = mapRect.height;
          
          let adjustX = 0;
          let adjustY = 0;
          
          // 화면 밖으로 나가는 경우에만 조정
          if (infoWindowLeft < margin) {
            adjustX = margin - infoWindowLeft;
          } else if (infoWindowRight > mapWidth - margin) {
            adjustX = (mapWidth - margin) - infoWindowRight;
          }
          
          if (infoWindowTop < margin) {
            adjustY = margin - infoWindowTop;
          } else if (infoWindowBottom > mapHeight - margin) {
            adjustY = (mapHeight - margin) - infoWindowBottom;
          }
          
          if (adjustX !== 0 || adjustY !== 0) {
            const currentTransform = infoWindowParent.style.transform || '';
            const translateMatch = currentTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
            const currentX = translateMatch ? parseFloat(translateMatch[1]) : 0;
            const currentY = translateMatch ? parseFloat(translateMatch[2]) : 0;
            
            infoWindowParent.style.transform = `translate(${currentX + adjustX}px, ${currentY + adjustY}px)`;
          }
        }, 100);
      };
      
      // 지도 크기 변경 이벤트 리스너 추가
      const resizeListener = google.maps.event.addListener(mapInstanceRef.current, 'resize', () => {
        adjustInfoWindowPosition();
      });
      
      // 컴포넌트 언마운트 시 리스너 제거를 위해 저장
      (infoWindow as any)._resizeListener = resizeListener;
      }
    }
    
    prevSelectedIdRef.current = currentSelectedId;
  }, [selectedAccommodationId, accommodations, onAccommodationSelect, onWishlistToggle, navigate]);
  
  // 선택 해제 시 마커를 호버 상태에 따라 복원
  useEffect(() => {
    if (!mapInstanceRef.current || selectedAccommodationId !== null) return;
    
    // 이전에 선택되었던 마커를 호버 상태에 따라 복원
    const prevSelectedId = prevSelectedIdRef.current;
    if (prevSelectedId !== null) {
      const prevMarker = markersRef.current.find((marker) => {
        const markerAccommodationId = (marker as any).accommodationId;
        return markerAccommodationId === prevSelectedId;
      });
      
      if (prevMarker) {
        const icons = (prevMarker as any).icons;
        const isHovered = hoveredAccommodationId === prevSelectedId;
        // 호버 상태면 호버 아이콘, 아니면 기본 아이콘
        prevMarker.setIcon(isHovered ? icons.hovered : icons.default);
      }
    }
  }, [selectedAccommodationId, hoveredAccommodationId]);
  
  // 호버된 숙소에 따라 마커 색상 업데이트 (InfoWindow가 열려있지 않은 마커만)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    const currentHoveredId = hoveredAccommodationId ?? null;
    const prevHoveredId = prevHoveredIdRef.current;
    
    // 이전에 호버되었던 마커를 원래 색상으로 복원 (InfoWindow가 열려있지 않은 경우만)
    if (prevHoveredId !== null && prevHoveredId !== currentHoveredId) {
      // InfoWindow가 열려있는 마커는 절대 건드리지 않음
      if (prevHoveredId !== selectedAccommodationId) {
        const prevMarker = markersRef.current.find((marker) => {
          const markerAccommodationId = (marker as any).accommodationId;
          return markerAccommodationId === prevHoveredId;
        });
        
        if (prevMarker) {
          const icons = (prevMarker as any).icons;
          // 기본 아이콘으로 복원
          prevMarker.setIcon(icons.default);
        }
      }
    }
    
    // 현재 호버된 마커를 검은색으로 표시 (InfoWindow가 열려있지 않은 경우만)
    if (currentHoveredId !== null && currentHoveredId !== selectedAccommodationId) {
      const hoveredMarker = markersRef.current.find((marker) => {
        const markerAccommodationId = (marker as any).accommodationId;
        return markerAccommodationId === currentHoveredId;
      });
      
      if (hoveredMarker) {
        const icons = (hoveredMarker as any).icons;
        // 미리 생성된 호버 아이콘 사용
        hoveredMarker.setIcon(icons.hovered);
      }
    }
    
    prevHoveredIdRef.current = currentHoveredId;
    hoveredAccommodationIdRef.current = currentHoveredId;
  }, [hoveredAccommodationId, selectedAccommodationId]);
  
  // InfoWindow가 열려있는 마커는 항상 selected 아이콘 유지 (별도 useEffect로 분리하여 최우선 처리)
  useEffect(() => {
    if (!mapInstanceRef.current || selectedAccommodationId === null) return;
    
    const currentSelectedId = selectedAccommodationId;
    const selectedMarker = markersRef.current.find((marker) => {
      const markerAccommodationId = (marker as any).accommodationId;
      return markerAccommodationId === currentSelectedId;
    });
    
    if (selectedMarker) {
      const icons = (selectedMarker as any).icons;
      // InfoWindow가 열려있으면 항상 selected 아이콘 유지 (다른 모든 로직보다 우선)
      selectedMarker.setIcon(icons.selected);
      
      let frameId: number | null = null;
      let isActive = true;
      
      // requestAnimationFrame을 사용하여 다음 프레임에서도 selected 아이콘 유지 확인
      const checkAndRestore = () => {
        if (!isActive) return;
        
        // 현재 selectedAccommodationId가 여전히 같은지 확인
        const marker = markersRef.current.find((m) => {
          const markerAccommodationId = (m as any).accommodationId;
          return markerAccommodationId === currentSelectedId;
        });
        
        if (marker) {
          const markerIcons = (marker as any).icons;
          // 현재 아이콘이 selected가 아니면 강제로 selected로 변경
          const currentIcon = marker.getIcon();
          if (currentIcon !== markerIcons.selected) {
            marker.setIcon(markerIcons.selected);
          }
          // 계속 확인
          frameId = requestAnimationFrame(checkAndRestore);
        }
      };
      
      // 다음 프레임부터 확인 시작
      frameId = requestAnimationFrame(checkAndRestore);
      
      return () => {
        isActive = false;
        if (frameId !== null) {
          cancelAnimationFrame(frameId);
        }
      };
    }
  }, [selectedAccommodationId]);

  // 지도 확장 상태 변경 시 버튼 아이콘 업데이트 및 지도 크기 조정
  useEffect(() => {
    if (!mapRef.current || !onExpandToggle || !isMapLoaded) return;

    const updateOrCreateButton = () => {
      if (!mapRef.current || !onExpandToggle) return;

      let expandButton = mapRef.current.querySelector('.map-expand-button') as HTMLElement;
      
      if (!expandButton) {
        // 버튼이 없으면 생성
        expandButton = document.createElement('button');
        expandButton.className = 'map-expand-button';
        expandButton.style.cssText = `
          position: absolute;
          top: 10px;
          right: 10px;
          width: 40px;
          height: 40px;
          background: white;
          border: none;
          border-radius: 2px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          cursor: pointer;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #222222;
          transition: background-color 0.2s ease;
        `;
        
        expandButton.addEventListener('mouseenter', () => {
          expandButton.style.backgroundColor = '#f7f7f7';
        });
        expandButton.addEventListener('mouseleave', () => {
          expandButton.style.backgroundColor = 'white';
        });

        // 클릭 이벤트 등록
        expandButton.addEventListener('click', (e) => {
          e.stopPropagation();
          if (onExpandToggle) {
            onExpandToggle();
          }
        });
        
        if (mapRef.current) {
          mapRef.current.appendChild(expandButton);
        }
      }

      // 기존 클릭 이벤트 리스너 제거 후 재등록 (innerHTML 변경 시 이벤트가 사라질 수 있음)
      const newExpandButton = expandButton.cloneNode(true) as HTMLElement;
      expandButton.parentNode?.replaceChild(newExpandButton, expandButton);
      
      // 이벤트 리스너 재등록
      newExpandButton.addEventListener('mouseenter', () => {
        newExpandButton.style.backgroundColor = '#f7f7f7';
      });
      newExpandButton.addEventListener('mouseleave', () => {
        newExpandButton.style.backgroundColor = 'white';
      });
      newExpandButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onExpandToggle) {
          onExpandToggle();
        }
      });

      // 아이콘 업데이트
      newExpandButton.innerHTML = isExpanded
        ? `
          <svg viewBox="0 0 24 24" fill="currentColor" style="width: 20px; height: 20px;">
            <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
          </svg>
        `
        : `
          <svg viewBox="0 0 24 24" fill="currentColor" style="width: 20px; height: 20px;">
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
          </svg>
        `;
      
      expandButton = newExpandButton;
    };

    // 지도가 로드된 후 버튼 생성/업데이트
    setTimeout(() => {
      updateOrCreateButton();
    }, 100);

    // 지도 크기 변경 알림
    if (mapInstanceRef.current) {
      setTimeout(() => {
        const map = mapInstanceRef.current;
        if (map) {
          google.maps.event.trigger(map, 'resize');
        }
      }, 100);
    }
  }, [isExpanded, onExpandToggle, isMapLoaded]);

  if (!isMapLoaded) {
    return (
      <div className={styles.mapContainer}>
        <div className={styles.loading}>지도를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className={styles.mapContainer}>
      <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      {isLoadingBounds && (
        <div className={styles.boundsLoadingOverlay}>
          <div className={styles.loadingDots}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}
    </div>
  );
};

