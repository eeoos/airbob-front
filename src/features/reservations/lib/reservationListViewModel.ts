import type {
  HostReservationInfo,
  MyReservationInfo,
} from "../../../types/reservation";
import { getImageUrl } from "../../../utils/image";
import { formatGuestTripDateRange } from "./guestTripGroups";
import { formatKoreanDate, formatNullablePrice } from "./reservationDateDisplay";
import type { ReservationStatusTone } from "./reservationStatusDisplay";
import {
  formatReservationStatus,
  getReservationStatusTone,
} from "./reservationStatusDisplay";

export interface GuestTripCardViewModel {
  id: number;
  reservationUid: string;
  accommodationName: string;
  thumbnailUrl: string | null;
  dateRangeLabel: string;
}

export interface HostReservationRowViewModel {
  reservationUid: string;
  statusLabel: string;
  statusTone: ReservationStatusTone;
  guestName: string;
  guestCountLabel: string;
  checkInLabel: string;
  checkOutLabel: string;
  createdAtLabel: string;
  accommodationName: string;
  reservationCodeLabel: string;
  totalPriceLabel: string;
}

export const toGuestTripCardViewModel = (
  reservation: MyReservationInfo,
): GuestTripCardViewModel => ({
  id: reservation.reservation_id,
  reservationUid: reservation.reservation_uid,
  accommodationName: reservation.accommodation.name,
  thumbnailUrl: reservation.accommodation.thumbnail_url
    ? getImageUrl(reservation.accommodation.thumbnail_url)
    : null,
  dateRangeLabel: formatGuestTripDateRange(
    reservation.check_in_date,
    reservation.check_out_date,
  ),
});

export const toHostReservationRowViewModel = (
  reservation: HostReservationInfo,
): HostReservationRowViewModel => ({
  reservationUid: reservation.reservation_uid,
  statusLabel: formatReservationStatus(reservation.status),
  statusTone: getReservationStatusTone(reservation.status),
  guestName: reservation.guest.nickname,
  guestCountLabel: `${reservation.guest_count}명`,
  checkInLabel: formatKoreanDate(reservation.check_in_date),
  checkOutLabel: formatKoreanDate(reservation.check_out_date),
  createdAtLabel: formatKoreanDate(reservation.created_at),
  accommodationName: reservation.accommodation.name,
  reservationCodeLabel: reservation.reservation_code || "-",
  totalPriceLabel: formatNullablePrice(reservation.total_price),
});
