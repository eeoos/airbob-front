import type {
  ReservationCreateInput,
  ReservationCreateRequestOptions,
  ReservationReady,
} from "../model/reservationCreate";

export interface ReservationCreateApiPort {
  create(
    input: ReservationCreateInput,
    options?: ReservationCreateRequestOptions,
  ): Promise<ReservationReady>;
}
