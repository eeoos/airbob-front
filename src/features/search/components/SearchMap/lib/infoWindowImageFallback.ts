const IMAGE_SELECTOR = "[data-info-window-image]";
const FALLBACK_SELECTOR = "[data-info-window-image-fallback]";

/**
 * Google Maps accepts an HTML string rather than React nodes. This adapter is
 * therefore intentionally imperative, but targets named elements inside one
 * owned info window instead of mutating DOM siblings or executing inline JS.
 */
export const bindInfoWindowImageFallback = (root: HTMLElement) => {
  const image = root.querySelector<HTMLImageElement>(IMAGE_SELECTOR);
  const fallback = root.querySelector<HTMLElement>(FALLBACK_SELECTOR);

  if (!image || !fallback) {
    return () => undefined;
  }

  const showFallback = () => {
    image.hidden = true;
    fallback.hidden = false;
  };

  image.addEventListener("error", showFallback);
  if (image.complete && image.naturalWidth === 0) {
    showFallback();
  }

  return () => image.removeEventListener("error", showFallback);
};
