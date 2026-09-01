export const RESERVATION_BOOKING_STATUSES = [
  "PAYMENT_PENDING",
  "PAYMENT_PROCESSING",
  "CONFIRMED",
  "CANCELLATION_PENDING",
  "CANCELLED",
  "CANCELLATION_FAILED",
  "EXPIRED",
] as const;

export type ReservationBookingStatus =
  (typeof RESERVATION_BOOKING_STATUSES)[number];

export interface ReservationQuoteInput {
  readonly accommodationId: number;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly guestCount: number;
  readonly couponId: number | null;
}

export interface ReservationQuote {
  readonly quoteUid: string;
  readonly accommodationId: number;
  readonly orderName: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly guestCount: number;
  readonly nightlyPrice: number;
  readonly nights: number;
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly amount: number;
  readonly currency: string;
  readonly paymentRequired: boolean;
  readonly inventoryHeld: false;
  readonly quoteExpiresAt: string;
  readonly serverTime: string;
}

export interface ReservationCheckoutInput {
  readonly quote: ReservationQuote;
  readonly idempotencyKey: string;
}

export interface ReservationReady {
  readonly reservationUid: string;
  readonly orderName: string;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly guestCount: number;
  readonly subtotal: number;
  readonly discountAmount: number;
  readonly amount: number;
  readonly currency: string;
  readonly status: ReservationBookingStatus;
  readonly paymentRequired: boolean;
  readonly paymentAllowed: boolean;
  readonly holdExpiresAt: string | null;
  readonly serverTime: string;
}

export interface ReservationBookingRequestOptions {
  readonly signal?: AbortSignal;
}
