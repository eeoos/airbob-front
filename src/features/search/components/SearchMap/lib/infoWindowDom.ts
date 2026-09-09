import {
  MAP_CARD_LAYOUT,
  getMapCardPlacement,
  getMarkerMapPoint,
} from "./infoWindowPlacement";

interface AdjustInfoWindowIntoMapViewOptions {
  mapElement: HTMLElement;
  map: google.maps.Map;
  position: google.maps.LatLngLiteral;
  markerHeight: number;
  offset: { x: number; y: number };
  setOffset: (x: number, y: number) => void;
}

export const adjustInfoWindowIntoMapView = ({
  mapElement,
  map,
  position,
  markerHeight,
  offset,
  setOffset,
}: AdjustInfoWindowIntoMapViewOptions) => {
  const container = mapElement.querySelector<HTMLElement>(".gm-style-iw-c");
  const card = container?.querySelector<HTMLElement>("[data-map-card]");
  if (!container || !card) return;
  applyInfoWindowChromeStyles(mapElement);
  const mapRect = mapElement.getBoundingClientRect();
  if (mapRect.width <= 0 || mapRect.height <= 0) return;
  const point = getMarkerMapPoint(map, position, mapRect.width, mapRect.height);
  if (!point) return;

  card.style.width = `${Math.max(0, Math.min(MAP_CARD_LAYOUT.width, mapRect.width - MAP_CARD_LAYOUT.margin * 2))}px`;
  card.style.maxHeight = `${Math.max(0, mapRect.height - MAP_CARD_LAYOUT.margin * 2)}px`;
  const rect = container.getBoundingClientRect();
  const placement = getMapCardPlacement({
    mapWidth: mapRect.width,
    mapHeight: mapRect.height,
    cardWidth: rect.width,
    cardHeight: rect.height,
    markerX: point.x,
    markerY: point.y,
    markerHeight,
  });
  const dx = placement.left - (rect.left - mapRect.left);
  const dy = placement.top - (rect.top - mapRect.top);
  if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
    setOffset(offset.x + dx, offset.y + dy);
  }
  card.dataset.placement = placement.side;
  card.style.visibility = "visible";
};

export const applyInfoWindowChromeStyles = (root: ParentNode) => {
  const infoWindowContent = root.querySelector<HTMLElement>(".gm-style-iw-d");
  if (infoWindowContent) {
    infoWindowContent.style.padding = "0";
    infoWindowContent.style.background = "transparent";
    infoWindowContent.style.boxShadow = "none";
    infoWindowContent.style.overflow = "visible";
    infoWindowContent.style.maxHeight = "none";
  }

  const infoWindowContainer = root.querySelector<HTMLElement>(".gm-style-iw-c");
  if (infoWindowContainer) {
    infoWindowContainer.style.padding = "0";
    infoWindowContainer.style.background = "transparent";
    infoWindowContainer.style.boxShadow = "none";
    infoWindowContainer.style.borderRadius = "12px";
    infoWindowContainer.style.overflow = "hidden";
    // The responsive card owns its bounds; Google's padding allowance would clip it.
    infoWindowContainer.style.maxWidth = "none";
    infoWindowContainer.style.maxHeight = "none";
  }

  root.querySelector<HTMLElement>(".gm-style-iw-chr")?.remove();
  root.querySelector<HTMLElement>(".gm-ui-hover-effect")?.remove();

  const closeButtonWrapper = root.querySelector<HTMLElement>(".gm-style-iw-ch");
  if (closeButtonWrapper && closeButtonWrapper.children.length === 0) {
    closeButtonWrapper.remove();
  }
};
