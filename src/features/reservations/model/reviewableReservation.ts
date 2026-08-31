interface ReviewableReservationAccommodation {
  readonly id: number;
  readonly name: string;
  readonly thumbnailUrl: string | null;
}

interface ReviewableReservationAddress {
  readonly country: string;
  readonly state: string | null;
  readonly city: string;
  readonly district: string | null;
  readonly street: string;
  readonly detail: string | null;
}

export interface ReviewableReservation {
  readonly reservationUid: string;
  readonly canWriteReview: boolean;
  readonly checkInDateTime: string;
  readonly checkOutDateTime: string;
  readonly accommodation: ReviewableReservationAccommodation;
  readonly address: ReviewableReservationAddress;
}

export interface ReviewableReservationRequestOptions {
  readonly signal?: AbortSignal;
}
