import {
  requestApiData,
  type ApiDataRequest,
} from "../../../../platform/http/request";
import type { ReservationBookingApiPort } from "../ports/reservationBookingApiPort";
import type { ReservationQuoteWire, ReservationReadyWire } from "./contracts";
import {
  toReservationCheckoutIdempotencyKey,
  toReservationCheckoutWireRequest,
  toReservationQuote,
  toReservationQuoteWireRequest,
  toReservationReady,
  validateReservationQuote,
} from "./mappers";

type ReservationBookingApiTransport = <T>(
  request: ApiDataRequest,
) => Promise<NonNullable<T>>;

const createReservationBookingApi = (
  request: ReservationBookingApiTransport,
): ReservationBookingApiPort => ({
  async createQuote(input, options) {
    const body = toReservationQuoteWireRequest(input);
    const wire = await request<ReservationQuoteWire>({
      method: "POST",
      path: "/reservation-quotes",
      body,
      signal: options?.signal,
    });

    return toReservationQuote(wire, input);
  },

  async checkout(input, options) {
    const quote = validateReservationQuote(input.quote);
    const body = toReservationCheckoutWireRequest({ ...input, quote });
    const idempotencyKey = toReservationCheckoutIdempotencyKey(
      input.idempotencyKey,
    );
    const wire = await request<ReservationReadyWire>({
      method: "POST",
      path: "/reservations",
      body,
      idempotencyKey,
      signal: options?.signal,
    });

    return toReservationReady(wire, quote);
  },
});

export const reservationBookingApi =
  createReservationBookingApi(requestApiData);
