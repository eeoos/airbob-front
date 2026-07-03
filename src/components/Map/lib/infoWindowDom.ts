interface AdjustInfoWindowIntoMapViewOptions {
  mapElement: HTMLElement;
  root?: ParentNode;
  infoWindowWidth?: number;
  margin?: number;
}

const parseTranslateTransform = (transform: string) => {
  const translateMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);

  return {
    x: translateMatch ? parseFloat(translateMatch[1]) : 0,
    y: translateMatch ? parseFloat(translateMatch[2]) : 0,
  };
};

export const adjustInfoWindowIntoMapView = ({
  mapElement,
  root = document,
  infoWindowWidth = 327,
  margin = 20,
}: AdjustInfoWindowIntoMapViewOptions) => {
  const infoWindowContainer = root.querySelector<HTMLElement>(".gm-style-iw-c");
  if (!infoWindowContainer) {
    return false;
  }

  const infoWindowParent = infoWindowContainer.parentElement;
  if (!infoWindowParent) {
    return false;
  }

  const mapRect = mapElement.getBoundingClientRect();
  const infoWindowRect = infoWindowContainer.getBoundingClientRect();
  const infoWindowHeight = infoWindowRect.height;

  const infoWindowLeft = infoWindowRect.left - mapRect.left;
  const infoWindowTop = infoWindowRect.top - mapRect.top;
  const infoWindowRight = infoWindowLeft + infoWindowWidth;
  const infoWindowBottom = infoWindowTop + infoWindowHeight;

  let adjustX = 0;
  let adjustY = 0;

  if (infoWindowLeft < margin) {
    adjustX = margin - infoWindowLeft;
  } else if (infoWindowRight > mapRect.width - margin) {
    adjustX = mapRect.width - margin - infoWindowRight;
  }

  if (infoWindowTop < margin) {
    adjustY = margin - infoWindowTop;
  } else if (infoWindowBottom > mapRect.height - margin) {
    adjustY = mapRect.height - margin - infoWindowBottom;
  }

  if (adjustX === 0 && adjustY === 0) {
    return false;
  }

  const currentTransform = parseTranslateTransform(
    infoWindowParent.style.transform || ""
  );
  infoWindowParent.style.transform = `translate(${currentTransform.x + adjustX}px, ${currentTransform.y + adjustY}px)`;

  return true;
};

export const applyInfoWindowChromeStyles = (root: ParentNode = document) => {
  const infoWindowContent = root.querySelector<HTMLElement>(".gm-style-iw-d");
  if (infoWindowContent) {
    infoWindowContent.style.padding = "0";
    infoWindowContent.style.background = "transparent";
    infoWindowContent.style.boxShadow = "none";
  }

  const infoWindowContainer = root.querySelector<HTMLElement>(".gm-style-iw-c");
  if (infoWindowContainer) {
    infoWindowContainer.style.padding = "0";
    infoWindowContainer.style.background = "transparent";
    infoWindowContainer.style.boxShadow = "none";
    infoWindowContainer.style.borderRadius = "12px";
    infoWindowContainer.style.overflow = "hidden";
  }

  root.querySelector<HTMLElement>(".gm-style-iw-chr")?.remove();
  root.querySelector<HTMLElement>(".gm-ui-hover-effect")?.remove();

  const closeButtonWrapper = root.querySelector<HTMLElement>(".gm-style-iw-ch");
  if (closeButtonWrapper && closeButtonWrapper.children.length === 0) {
    closeButtonWrapper.remove();
  }
};
