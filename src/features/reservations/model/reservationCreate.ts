export interface ReservationCreateInput {
  readonly accommodationId: number;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly guestCount: number;
  readonly couponId: number | null;
}

export interface ReservationReady {
  readonly reservationUid: string;
  readonly orderName: string;
  readonly amount: number;
  readonly customerEmail: string;
  readonly customerName: string;
}

export interface ReservationCreateRequestOptions {
  readonly signal?: AbortSignal;
}
