import { useCallback, useState } from "react";

interface SearchMapSelectionTarget {
  id: number;
}

export const useSearchMapState = () => {
  const [selectedAccommodationId, setSelectedAccommodationId] = useState<
    number | null
  >(null);
  const [hoveredAccommodationId, setHoveredAccommodationId] = useState<
    number | null
  >(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isMapDragMode, setIsMapDragMode] = useState(false);
  const [shouldUpdateMapBounds, setShouldUpdateMapBounds] = useState(false);

  const handleAccommodationSelect = useCallback((
    accommodation: SearchMapSelectionTarget | null
  ) => {
    if (!accommodation) {
      setSelectedAccommodationId(null);
      return;
    }

    setSelectedAccommodationId(accommodation.id);
    const element = document.getElementById(`accommodation-${accommodation.id}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const selectAccommodationId = useCallback((accommodationId: number) => {
    setSelectedAccommodationId(accommodationId);
  }, []);

  const toggleMapExpanded = useCallback(() => {
    setIsMapExpanded((currentIsMapExpanded) => !currentIsMapExpanded);
  }, []);

  const requestMapBoundsUpdate = useCallback(() => {
    setShouldUpdateMapBounds(true);
  }, []);

  const onMapBoundsUpdated = useCallback(() => {
    setShouldUpdateMapBounds(false);
  }, []);

  return {
    selectedAccommodationId,
    hoveredAccommodationId,
    isMapExpanded,
    isMapDragMode,
    shouldUpdateMapBounds,
    setHoveredAccommodationId,
    setIsMapDragMode,
    handleAccommodationSelect,
    selectAccommodationId,
    toggleMapExpanded,
    requestMapBoundsUpdate,
    onMapBoundsUpdated,
  };
};
