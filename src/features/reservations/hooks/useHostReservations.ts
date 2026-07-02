import { reservationApi } from "../../../api";
import {
  HostReservationInfo,
  ReservationFilterType,
} from "../../../types/reservation";
import { useReservationList } from "./useReservationList";

export function useHostReservations(filterType: ReservationFilterType) {
  return useReservationList<HostReservationInfo>(
    filterType,
    reservationApi.getHostReservations
  );
}
