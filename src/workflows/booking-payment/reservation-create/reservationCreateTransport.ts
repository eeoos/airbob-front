import { reservationCreateApi } from "../../../features/reservations/public";
import type { ReservationCreateTransport } from "./reservationCreateTypes";

export const reservationCreateTransport: ReservationCreateTransport =
  reservationCreateApi;
