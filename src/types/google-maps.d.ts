/// <reference types="google.maps" />

declare global {
  interface Window {
    google: typeof google;
    toggleWishlist?: (accommodationId: number, isInWishlist: boolean) => void;
    closeInfoWindow?: () => void;
  }
}

export {};



