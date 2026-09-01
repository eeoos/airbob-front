import type {
  ReservationBookingRequestOptions,
  ReservationCheckoutInput,
  ReservationQuote,
  ReservationQuoteInput,
  ReservationReady,
} from "../model/booking";

export interface ReservationBookingApiPort {
  createQuote(
    input: ReservationQuoteInput,
    options?: ReservationBookingRequestOptions,
  ): Promise<ReservationQuote>;
  checkout(
    input: ReservationCheckoutInput,
    options?: ReservationBookingRequestOptions,
  ): Promise<ReservationReady>;
}
