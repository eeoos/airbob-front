import type { AddressSummaryInfo, HostAccommodationInfo } from "../../../types/accommodation";
import { AccommodationStatus } from "../../../types/enums";

export interface HostListingViewModel {
  canOpenDetail: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  id: number;
  imageAlt: string;
  locationLabel: string;
  managementLabel: string;
  name: string;
  statusLabel: string;
  thumbnailUrl: string | null;
}

const getHostListingName = (name: string | null): string => name || "이름 없음";

const getHostListingImageAlt = (name: string | null): string => name || "숙소";

const getHostListingLocationLabel = (
  addressSummary: AddressSummaryInfo | null,
): string => {
  if (!addressSummary) {
    return "위치 정보 없음";
  }

  return (
    [addressSummary.city, addressSummary.district].filter(Boolean).join(", ") ||
    addressSummary.country
  );
};

const getHostListingStatusLabel = (
  status: HostAccommodationInfo["status"],
): string => {
  switch (status) {
    case AccommodationStatus.PUBLISHED:
      return "공개";
    case AccommodationStatus.DRAFT:
      return "작성 중";
    case AccommodationStatus.UNPUBLISHED:
      return "비공개";
    default:
      return status;
  }
};

export const toHostListingViewModel = (
  accommodation: HostAccommodationInfo,
): HostListingViewModel => {
  const name = getHostListingName(accommodation.name);

  return {
    canOpenDetail: accommodation.status === AccommodationStatus.PUBLISHED,
    canPublish: accommodation.status === AccommodationStatus.UNPUBLISHED,
    canUnpublish: accommodation.status === AccommodationStatus.PUBLISHED,
    id: accommodation.id,
    imageAlt: getHostListingImageAlt(accommodation.name),
    locationLabel: getHostListingLocationLabel(accommodation.address_summary),
    managementLabel: `${name} 숙소 관리 열기`,
    name,
    statusLabel: getHostListingStatusLabel(accommodation.status),
    thumbnailUrl: accommodation.thumbnail_url,
  };
};

export const toHostListingViewModels = (
  accommodations: HostAccommodationInfo[],
): HostListingViewModel[] => accommodations.map(toHostListingViewModel);
