export interface AccommodationDetailAddressSummaryWire {
  readonly country: string;
  readonly state: string | null;
  readonly city: string;
  readonly district: string | null;
}

export interface AccommodationDetailCoordinateWire {
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface AccommodationDetailHostWire {
  readonly id: number;
  readonly nickname: string;
  readonly thumbnail_image_url: string | null;
}

export interface AccommodationDetailPolicyWire {
  readonly max_occupancy: number;
  readonly infant_occupancy: number;
  readonly pet_occupancy: number;
}

export interface AccommodationDetailAmenityWire {
  readonly type: string;
  readonly count: number;
}

export interface AccommodationDetailImageWire {
  readonly id: number;
  readonly image_url: string;
}

export interface AccommodationDetailReviewSummaryWire {
  readonly total_count: number;
  readonly average_rating: number;
}

export interface AccommodationDetailWire {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly type: string;
  readonly base_price: number;
  readonly currency: string;
  readonly check_in_time: string;
  readonly check_out_time: string;
  readonly unavailable_dates: readonly string[];
  readonly is_in_wishlist: boolean;
  readonly address_summary: AccommodationDetailAddressSummaryWire;
  readonly coordinate: AccommodationDetailCoordinateWire;
  readonly host: AccommodationDetailHostWire;
  readonly policy: AccommodationDetailPolicyWire;
  readonly amenities: readonly AccommodationDetailAmenityWire[];
  readonly images: readonly AccommodationDetailImageWire[];
  readonly review_summary: AccommodationDetailReviewSummaryWire;
}

export type CouponDiscountTypeWire = "PERCENTAGE" | "FIXED_AMOUNT";

export interface CouponWire {
  readonly id: number;
  readonly name: string;
  readonly description: string | null;
  readonly discount_type: CouponDiscountTypeWire;
  readonly discount_value: number;
  readonly min_payment_price: number | null;
  readonly max_discount_amount: number | null;
  readonly start_date: string;
  readonly end_date: string;
  readonly total_quantity: number | null;
  readonly issued_quantity: number;
}

export interface CouponCollectionWire {
  readonly infos: readonly CouponWire[];
}
