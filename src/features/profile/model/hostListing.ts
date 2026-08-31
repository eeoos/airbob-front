export type HostListingStatus =
  "PUBLISHED" | "DRAFT" | "UNPUBLISHED" | "DELETED";

export type HostListingFilterStatus = Exclude<HostListingStatus, "DELETED">;

export interface HostListingAddressSummary {
  readonly country: string;
  readonly state: string | null;
  readonly city: string;
  readonly district: string | null;
}

export interface HostListing {
  readonly id: number;
  readonly name: string | null;
  readonly thumbnailUrl: string | null;
  readonly status: HostListingStatus;
  readonly type: string | null;
  readonly addressSummary: HostListingAddressSummary | null;
  readonly createdAt: string;
}

export interface HostListingPageInfo {
  readonly currentSize: number;
  readonly hasNext: boolean;
  readonly nextCursor: string | null;
}

export interface HostListingPage {
  readonly listings: readonly HostListing[];
  readonly pageInfo: HostListingPageInfo;
}
