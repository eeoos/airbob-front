import type { RecentlyViewedCollectionWire } from "./contracts";
import { platformApiTransport, type ApiTransport } from "./transport";
import { toRecentlyViewedCollection } from "./mappers";
import type { RecentlyViewedApiPort } from "../ports/recentlyViewedApiPort";

export const createRecentlyViewedApi = (
  transport: ApiTransport,
): RecentlyViewedApiPort => ({
  async getRecentlyViewed(options) {
    const wire = await transport.request<RecentlyViewedCollectionWire>({
      method: "GET",
      path: "/members/recently-viewed",
      signal: options?.signal,
    });

    return toRecentlyViewedCollection(wire);
  },

  async add(accommodationId, options) {
    await transport.requestNullable<never>({
      method: "POST",
      path: `/members/recently-viewed/${accommodationId}`,
      signal: options?.signal,
    });
  },

  async remove(accommodationId, options) {
    await transport.requestNullable<never>({
      method: "DELETE",
      path: `/members/recently-viewed/${accommodationId}`,
      signal: options?.signal,
    });
  },
});

export const recentlyViewedApi = createRecentlyViewedApi(platformApiTransport);
