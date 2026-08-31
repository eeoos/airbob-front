import type {
  HostListingFilterStatus,
  HostListingPage,
} from "../model/hostListing";

export interface HostListingsRequest {
  readonly cursor?: string;
  readonly size: number;
  readonly status: HostListingFilterStatus;
}

export interface HostListingsRequestOptions {
  readonly signal: AbortSignal;
}

export interface HostListingsApiPort {
  getHostListings(
    request: HostListingsRequest,
    options: HostListingsRequestOptions,
  ): Promise<HostListingPage>;
}
