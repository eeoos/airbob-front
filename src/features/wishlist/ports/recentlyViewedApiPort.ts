import type { ApiRequestOptions, RecentlyViewedCollection } from "../model";

export interface RecentlyViewedApiPort {
  getRecentlyViewed(
    options?: ApiRequestOptions,
  ): Promise<RecentlyViewedCollection>;
  add(accommodationId: number, options?: ApiRequestOptions): Promise<void>;
  remove(accommodationId: number, options?: ApiRequestOptions): Promise<void>;
}
