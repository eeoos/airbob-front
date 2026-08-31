import { resolveImageUrl as defaultResolveImageUrl } from "../../../platform/assets/imageUrl";
import type {
  GuestReservationListItem,
  HostReservationListItem,
} from "../model/reservationRead";
import { formatGuestTripDateRange } from "./guestTripGroups";
import {
  formatKoreanDate,
  formatNullablePrice,
} from "./reservationDateDisplay";
import type { ReservationStatusTone } from "./reservationStatusDisplay";
import {
  formatReservationStatus,
  getReservationStatusTone,
} from "./reservationStatusDisplay";

export interface GuestTripCardViewModel {
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
  reservation: GuestReservationListItem,
  resolveImageUrl: (path: string | null) => string = defaultResolveImageUrl,
): GuestTripCardViewModel => ({
  reservationUid: reservation.reservationUid,
  accommodationName: reservation.accommodation.name,
  thumbnailUrl: reservation.accommodation.thumbnailUrl
    ? resolveImageUrl(reservation.accommodation.thumbnailUrl)
    : null,
  dateRangeLabel: formatGuestTripDateRange(
    reservation.checkInDate,
    reservation.checkOutDate,
  ),
});

export const toHostReservationRowViewModel = (
  reservation: HostReservationListItem,
): HostReservationRowViewModel => ({
  reservationUid: reservation.reservationUid,
  statusLabel: formatReservationStatus(reservation.status),
  statusTone: getReservationStatusTone(reservation.status),
  guestName: reservation.guest.nickname,
  guestCountLabel: `${reservation.guestCount}명`,
  checkInLabel: formatKoreanDate(reservation.checkInDate),
  checkOutLabel: formatKoreanDate(reservation.checkOutDate),
  createdAtLabel: formatKoreanDate(reservation.createdAt),
  accommodationName: reservation.accommodation.name,
  reservationCodeLabel: reservation.reservationCode || "-",
  totalPriceLabel: formatNullablePrice(reservation.totalPrice),
});
