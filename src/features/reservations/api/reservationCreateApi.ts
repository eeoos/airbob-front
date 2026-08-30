import {
  requestApiData,
  type ApiDataRequest,
} from "../../../platform/http/request";
import type {
  ReservationCreateInput,
  ReservationReady,
} from "../model/reservationCreate";
import type { ReservationCreateApiPort } from "../ports/reservationCreateApiPort";
import type {
  ReservationCreateWireRequest,
  ReservationReadyWire,
} from "./reservationCreateContracts";

export type ReservationCreateApiTransport = <T>(
  request: ApiDataRequest,
) => Promise<NonNullable<T>>;

const toReservationCreateWireRequest = (
  input: ReservationCreateInput,
): ReservationCreateWireRequest => ({
  accommodation_id: input.accommodationId,
  check_in_date: input.checkIn,
  check_out_date: input.checkOut,
  guest_count: input.guestCount,
  ...(input.couponId === null ? {} : { coupon_id: input.couponId }),
});

const toReservationReady = (wire: ReservationReadyWire): ReservationReady => ({
  reservationUid: wire.reservation_uid,
  orderName: wire.order_name,
  amount: wire.amount,
  customerEmail: wire.customer_email,
  customerName: wire.customer_name,
});

export const createReservationCreateApi = (
  request: ReservationCreateApiTransport,
): ReservationCreateApiPort => ({
  async create(input, options) {
    const wire = await request<ReservationReadyWire>({
      method: "POST",
      path: "/reservations",
      body: toReservationCreateWireRequest(input),
      signal: options?.signal,
    });

    return toReservationReady(wire);
  },
});

export const reservationCreateApi = createReservationCreateApi(requestApiData);
