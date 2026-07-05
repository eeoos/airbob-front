interface BindInfoWindowEventsOptions {
  root: HTMLElement;
  onCardClick: () => void;
  onClose: () => void;
  onWishlistToggle?: (accommodationId: number, isInWishlist: boolean) => void;
}

const INFO_WINDOW_ACTION_SELECTOR = "[data-info-window-action]";

const parseSafeAccommodationId = (value: string | undefined) => {
  if (!value) {
    return null;
  }

  const accommodationId = Number(value);
  return Number.isSafeInteger(accommodationId) ? accommodationId : null;
};

export const bindInfoWindowEvents = ({
  root,
  onCardClick,
  onClose,
  onWishlistToggle,
}: BindInfoWindowEventsOptions) => {
  const handleClick = (event: MouseEvent) => {
    const actionElement =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>(INFO_WINDOW_ACTION_SELECTOR)
        : null;
    const action = actionElement?.dataset.infoWindowAction;

    if (actionElement && action === "wishlist") {
      event.stopPropagation();

      const accommodationId = parseSafeAccommodationId(
        actionElement.dataset.accommodationId,
      );
      if (accommodationId !== null) {
        onWishlistToggle?.(
          accommodationId,
          actionElement.dataset.isInWishlist === "true",
        );
      }

      return;
    }

    if (actionElement && action === "close") {
      event.stopPropagation();
      onClose();
      return;
    }

    onCardClick();
  };

  root.addEventListener("click", handleClick);

  return () => {
    root.removeEventListener("click", handleClick);
  };
};
