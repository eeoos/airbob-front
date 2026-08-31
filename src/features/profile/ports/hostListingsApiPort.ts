import type {
  HostListingFilterStatus,
  HostListingPage,
} from "../model/hostListing";

export interface HostListingsApiPort {
  getHostListings(
    request: {
      readonly cursor?: string;
      readonly size: number;
      readonly status: HostListingFilterStatus;
    },
    options: { readonly signal: AbortSignal },
  ): Promise<HostListingPage>;
}
