import { reservationApi } from "../../../api";
import {
  MyReservationInfo,
  ReservationFilterType,
} from "../../../types/reservation";
import { useReservationList } from "./useReservationList";

export function useGuestTrips(filterType: ReservationFilterType) {
  return useReservationList<MyReservationInfo>(
    filterType,
    reservationApi.getMyReservations
  );
}
