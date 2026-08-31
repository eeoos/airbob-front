import { requestApiData } from "../../../platform/http/request";
import type { HostListingsApiPort } from "../ports/hostListingsApiPort";
import type { HostListingPageWire } from "./hostListingsContracts";
import { toHostListingPage } from "./hostListingsMappers";

export type HostListingsApiTransport = typeof requestApiData;

export const createHostListingsApi = (
  request: HostListingsApiTransport = requestApiData,
): HostListingsApiPort => ({
  async getHostListings({ cursor, size, status }, { signal }) {
    const wire = await request<HostListingPageWire>({
      method: "GET",
      path: "/profile/host/accommodations",
      params: {
        size,
        status,
        ...(cursor === undefined ? {} : { cursor }),
      },
      signal,
    });

    return toHostListingPage(wire);
  },
});

export const hostListingsApi = createHostListingsApi();
