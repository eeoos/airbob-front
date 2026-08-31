interface ReviewableReservationAccommodationWire {
  readonly id: number;
  readonly name: string;
  readonly thumbnail_url: string | null;
}

interface ReviewableReservationAddressWire {
  readonly country: string;
  readonly state: string | null;
  readonly city: string;
  readonly district: string | null;
  readonly street: string;
  readonly detail: string | null;
}

export interface ReviewableReservationWire {
  readonly reservation_uid: string;
  readonly can_write_review: boolean;
  readonly check_in_date_time: string;
  readonly check_out_date_time: string;
  readonly accommodation: ReviewableReservationAccommodationWire;
  readonly address: ReviewableReservationAddressWire;
}
