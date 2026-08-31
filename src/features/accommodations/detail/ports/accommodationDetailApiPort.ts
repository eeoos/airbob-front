import type {
  AccommodationApiRequestOptions,
  AccommodationDetail,
} from "../model/accommodationDetail";

export interface AccommodationDetailApiPort {
  getDetail(
    accommodationId: number,
    options?: AccommodationApiRequestOptions,
  ): Promise<AccommodationDetail>;
}
