import React from "react";
import { ListContainer } from "../../../shared/ui/ListContainer";
import type { SearchAccommodationCardViewModel } from "../lib/searchAccommodationViewModel";
import { SearchAccommodationCard } from "./SearchAccommodationCard";

type SearchResultsLayout = "desktop" | "bottomSheet";

interface SearchResultsListClassNames {
  loading?: string;
  empty?: string;
  cardGrid?: string;
  cardWrapper?: string;
  selected?: string;
}

interface SearchResultsListProps {
  accommodations: SearchAccommodationCardViewModel[];
  isLoading: boolean;
  selectedAccommodationId: number | null;
  onAccommodationClick: (accommodationId: number) => void;
  onWishlistToggle?: ((accommodationId: number) => void) | undefined;
  onHoveredAccommodationChange?:
    ((accommodationId: number | null) => void) | undefined;
  getAccommodationHref: (accommodationId: number) => string;
  checkIn?: string | null | undefined;
  checkOut?: string | null | undefined;
  layout?: SearchResultsLayout | undefined;
  classNames?: SearchResultsListClassNames | undefined;
}

const classNamesFor = (...classNames: Array<string | undefined>): string =>
  classNames.filter(Boolean).join(" ");

export const SearchResultsList: React.FC<SearchResultsListProps> = ({
  accommodations,
  isLoading,
  selectedAccommodationId,
  onAccommodationClick,
  onWishlistToggle,
  onHoveredAccommodationChange,
  getAccommodationHref,
  checkIn,
  checkOut,
  layout = "desktop",
  classNames,
}) => {
  if (isLoading && accommodations.length === 0) {
    return <div className={classNames?.loading}>로딩 중...</div>;
  }

  if (accommodations.length === 0) {
    return <div className={classNames?.empty}>검색 결과가 없습니다.</div>;
  }

  const cards = accommodations.map((accommodation) => (
    <div
      key={accommodation.id}
      id={`accommodation-${accommodation.id}`}
      onMouseEnter={() => onHoveredAccommodationChange?.(accommodation.id)}
      onMouseLeave={() => onHoveredAccommodationChange?.(null)}
      className={classNamesFor(
        classNames?.cardWrapper,
        selectedAccommodationId === accommodation.id
          ? classNames?.selected
          : undefined,
      )}
    >
      <SearchAccommodationCard
        accommodation={accommodation}
        checkIn={checkIn}
        checkOut={checkOut}
        detailUrl={getAccommodationHref(accommodation.id)}
        onClick={() => onAccommodationClick(accommodation.id)}
        onWishlistToggle={
          onWishlistToggle
            ? () => onWishlistToggle(accommodation.id)
            : undefined
        }
      />
    </div>
  ));

  if (layout === "bottomSheet") {
    return <div className={classNames?.cardGrid}>{cards}</div>;
  }

  return (
    <ListContainer columns={3} gap={10}>
      {cards}
    </ListContainer>
  );
};
