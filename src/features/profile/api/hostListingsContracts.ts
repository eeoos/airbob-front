import type { HostListingStatus } from "../model/hostListing";

export type HostListingStatusWire = HostListingStatus;

export interface HostListingAddressSummaryWire {
  readonly country: string;
  readonly state: string | null;
  readonly city: string;
  readonly district: string | null;
}

export interface HostListingWire {
  readonly id: number;
  readonly name: string | null;
  readonly thumbnail_url: string | null;
  readonly status: HostListingStatusWire;
  readonly type: string | null;
  readonly address_summary: HostListingAddressSummaryWire | null;
  readonly created_at: string;
}

export interface HostListingPageWire {
  readonly accommodations: readonly HostListingWire[];
  readonly page_info: {
    readonly current_size: number;
    readonly has_next: boolean;
    readonly next_cursor: string | null;
  };
}
