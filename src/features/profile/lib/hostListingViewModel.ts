import { resolveImageUrl as defaultResolveImageUrl } from "../../../platform/assets/imageUrl";
import type {
  HostListing,
  HostListingAddressSummary,
} from "../model/hostListing";

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
  addressSummary: HostListingAddressSummary | null,
): string => {
  if (!addressSummary) {
    return "위치 정보 없음";
  }

  return (
    [addressSummary.city, addressSummary.district].filter(Boolean).join(", ") ||
    addressSummary.country
  );
};

const getHostListingStatusLabel = (status: HostListing["status"]): string => {
  switch (status) {
    case "PUBLISHED":
      return "공개";
    case "DRAFT":
      return "작성 중";
    case "UNPUBLISHED":
      return "비공개";
    default:
      return status;
  }
};

const toHostListingViewModel = (
  accommodation: HostListing,
  resolveImageUrl: (path: string | null) => string = defaultResolveImageUrl,
): HostListingViewModel => {
  const name = getHostListingName(accommodation.name);

  return {
    canOpenDetail: accommodation.status === "PUBLISHED",
    canPublish: accommodation.status === "UNPUBLISHED",
    canUnpublish: accommodation.status === "PUBLISHED",
    id: accommodation.id,
    imageAlt: getHostListingImageAlt(accommodation.name),
    locationLabel: getHostListingLocationLabel(accommodation.addressSummary),
    managementLabel: `${name} 숙소 관리 열기`,
    name,
    statusLabel: getHostListingStatusLabel(accommodation.status),
    thumbnailUrl: accommodation.thumbnailUrl
      ? resolveImageUrl(accommodation.thumbnailUrl)
      : null,
  };
};

export const toHostListingViewModels = (
  accommodations: readonly HostListing[],
  resolveImageUrl: (path: string | null) => string = defaultResolveImageUrl,
): HostListingViewModel[] =>
  accommodations.map((accommodation) =>
    toHostListingViewModel(accommodation, resolveImageUrl),
  );
