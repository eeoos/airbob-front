import { resolveImageUrl as defaultResolveImageUrl } from "../../../platform/assets/imageUrl";
import type { HostReservationDetail } from "../model/reservationRead";
import {
  formatKoreanDateWithWeekday,
  formatNullablePrice,
} from "./reservationDateDisplay";
import {
  formatReservationStatus,
  getReservationStatusTone,
} from "./reservationStatusDisplay";

interface HostReservationGuestViewModel {
  nickname: string;
  avatarUrl: string | null;
  avatarInitial: string;
}

interface HostReservationAccommodationViewModel {
  id: number;
  name: string;
  thumbnailUrl: string | null;
}

interface HostReservationPaymentViewModel {
  nights: number;
  pricePerNightLabel: string;
  totalAmountLabel: string;
}

export interface HostReservationDetailViewModel {
  reservationCode: string;
  statusLabel: string;
  statusTone: ReturnType<typeof getReservationStatusTone>;
  guest: HostReservationGuestViewModel;
  guestStaySummaryLabel: string;
  accommodation: HostReservationAccommodationViewModel;
  addressLabel: string;
  guestCountLabel: string;
  checkInDateLabel: string;
  checkOutDateLabel: string;
  createdAtDateLabel: string;
  payment: HostReservationPaymentViewModel | null;
}

const calculateHostReservationNights = (
  checkIn: string,
  checkOut: string,
): number => {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const diffTime = checkOutDate.getTime() - checkInDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 1;
};

const getAddressLabel = (reservation: HostReservationDetail): string =>
  [
    reservation.address.country,
    reservation.address.state,
    reservation.address.city,
    reservation.address.district,
    reservation.address.street,
    reservation.address.detail,
  ]
    .filter(Boolean)
    .join(" ");

const toPaymentViewModel = (
  reservation: HostReservationDetail,
  nights: number,
): HostReservationPaymentViewModel | null => {
  if (!reservation.payment) {
    return null;
  }

  const totalAmount = reservation.payment.totalAmount || 0;
  const pricePerNight = Math.floor(totalAmount / nights);

  return {
    nights,
    pricePerNightLabel: formatNullablePrice(pricePerNight),
    totalAmountLabel: formatNullablePrice(totalAmount),
  };
};

export const toHostReservationDetailViewModel = (
  reservation: HostReservationDetail,
  resolveImageUrl: (path: string | null) => string = defaultResolveImageUrl,
): HostReservationDetailViewModel => {
  const nights = calculateHostReservationNights(
    reservation.checkInDateTime,
    reservation.checkOutDateTime,
  );
  const payment = toPaymentViewModel(reservation, nights);
  const totalAmount = reservation.payment?.totalAmount || 0;

  return {
    reservationCode: reservation.reservationCode,
    statusLabel: formatReservationStatus(reservation.status),
    statusTone: getReservationStatusTone(reservation.status),
    guest: {
      nickname: reservation.guest.nickname,
      avatarUrl: reservation.guest.thumbnailImageUrl
        ? resolveImageUrl(reservation.guest.thumbnailImageUrl)
        : null,
      avatarInitial: reservation.guest.nickname.charAt(0).toUpperCase(),
    },
    guestStaySummaryLabel: [
      `${reservation.guestCount}게스트`,
      `${nights}박`,
      reservation.payment && totalAmount > 0
        ? formatNullablePrice(totalAmount)
        : null,
    ]
      .filter(Boolean)
      .join(" • "),
    accommodation: {
      id: reservation.accommodation.id,
      name: reservation.accommodation.name,
      thumbnailUrl: reservation.accommodation.thumbnailUrl
        ? resolveImageUrl(reservation.accommodation.thumbnailUrl)
        : null,
    },
    addressLabel: getAddressLabel(reservation),
    guestCountLabel: `${reservation.guestCount}명`,
    checkInDateLabel: formatKoreanDateWithWeekday(reservation.checkInDateTime),
    checkOutDateLabel: formatKoreanDateWithWeekday(
      reservation.checkOutDateTime,
    ),
    createdAtDateLabel: formatKoreanDateWithWeekday(reservation.createdAt),
    payment,
  };
};
