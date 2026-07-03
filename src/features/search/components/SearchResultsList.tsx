import React from "react";
import { AccommodationCardSearch } from "../../../components/AccommodationCard";
import { ListContainer } from "../../../components/ListContainer";
import { routeTo } from "../../../routes/paths";
import { AccommodationSearchInfo } from "../../../types/accommodation";

type SearchResultsLayout = "desktop" | "bottomSheet";

interface SearchResultsListClassNames {
  loading?: string;
  empty?: string;
  cardGrid?: string;
  cardWrapper?: string;
  selected?: string;
}

interface SearchResultsListProps {
  accommodations: AccommodationSearchInfo[];
  isLoading: boolean;
  selectedAccommodationId: number | null;
  onAccommodationClick: (accommodationId: number) => void;
  onWishlistToggle: (accommodationId: number) => void;
  onHoveredAccommodationChange?: (accommodationId: number | null) => void;
  detailSearchParams?: URLSearchParams;
  checkIn?: string | null;
  checkOut?: string | null;
  layout?: SearchResultsLayout;
  classNames?: SearchResultsListClassNames;
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
  detailSearchParams,
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
          : undefined
      )}
    >
      <AccommodationCardSearch
        accommodation={accommodation}
        detailUrl={routeTo.accommodationDetail(
          accommodation.id,
          detailSearchParams
        )}
        onClick={() => onAccommodationClick(accommodation.id)}
        onWishlistToggle={() => onWishlistToggle(accommodation.id)}
        checkIn={checkIn}
        checkOut={checkOut}
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
