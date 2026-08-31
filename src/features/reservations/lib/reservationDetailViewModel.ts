import { resolveImageUrl as defaultResolveImageUrl } from "../../../platform/assets/imageUrl";
import type { GuestReservationDetail } from "../model/reservationRead";
import {
  canCreateReview,
  formatBankName,
  formatPaymentStatus,
  formatReservationDetailDate,
  formatReservationDetailTime,
} from "./reservationDetailDisplay";
import {
  formatKoreanDateTime,
  formatNullablePrice,
} from "./reservationDateDisplay";
import {
  formatReservationStatus,
  getReservationStatusTone,
} from "./reservationStatusDisplay";

type PaymentStatusTone = "success" | "warning" | "neutral";

interface ReservationDateTimeViewModel {
  dateLabel: string;
  timeLabel: string;
}

interface ReservationPaymentViewModel {
  methodLabel: string;
  amountLabel: string;
  approvedAtLabel: string | null;
  statusLabel: string;
  statusTone: PaymentStatusTone;
  virtualAccount: {
    bankName: string;
    accountNumber: string;
    customerName: string;
    dueDateLabel: string;
  } | null;
}

export interface ReservationDetailViewModel {
  reservationUid: string;
  reservationCode: string;
  guestCountLabel: string;
  accommodation: {
    id: number;
    name: string;
    thumbnailUrl: string | null;
  };
  addressLabel: string;
  checkIn: ReservationDateTimeViewModel;
  checkOut: ReservationDateTimeViewModel;
  host: {
    nickname: string;
    displayName: string;
    avatarUrl: string | null;
    avatarInitial: string;
  };
  status: {
    label: string;
    tone: ReturnType<typeof getReservationStatusTone>;
  };
  canReview: boolean;
  payment: ReservationPaymentViewModel | null;
  mapCoordinate: {
    latitude: number;
    longitude: number;
  } | null;
}

const getAddressLabel = (reservation: GuestReservationDetail): string =>
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

const getMapCoordinate = (
  reservation: GuestReservationDetail,
): ReservationDetailViewModel["mapCoordinate"] => {
  if (
    reservation.coordinate.latitude == null ||
    reservation.coordinate.longitude == null
  ) {
    return null;
  }

  return {
    latitude: reservation.coordinate.latitude,
    longitude: reservation.coordinate.longitude,
  };
};

const getPaymentStatusTone = (
  payment: NonNullable<GuestReservationDetail["payment"]>,
): PaymentStatusTone => {
  if (payment.status === "DONE") {
    return "success";
  }

  if (payment.virtualAccount && payment.status === "WAITING_FOR_DEPOSIT") {
    return "warning";
  }

  return "neutral";
};

const toReservationPaymentViewModel = (
  payment: GuestReservationDetail["payment"],
): ReservationPaymentViewModel | null => {
  if (!payment) return null;

  const isVirtualAccountPending =
    payment.virtualAccount && payment.status === "WAITING_FOR_DEPOSIT";

  return {
    methodLabel: payment.method ?? "-",
    amountLabel: formatNullablePrice(payment.totalAmount),
    approvedAtLabel: payment.approvedAt
      ? formatKoreanDateTime(payment.approvedAt)
      : null,
    statusLabel: formatPaymentStatus(payment.status),
    statusTone: getPaymentStatusTone(payment),
    virtualAccount: isVirtualAccountPending
      ? {
          bankName: formatBankName(payment.virtualAccount?.bankCode),
          accountNumber: payment.virtualAccount?.accountNumber ?? "-",
          customerName: payment.virtualAccount?.customerName ?? "-",
          dueDateLabel: payment.virtualAccount?.dueDate
            ? formatKoreanDateTime(payment.virtualAccount.dueDate)
            : "-",
        }
      : null,
  };
};

export const toReservationDetailViewModel = (
  reservation: GuestReservationDetail,
  resolveImageUrl: (path: string | null) => string = defaultResolveImageUrl,
): ReservationDetailViewModel => ({
  reservationUid: reservation.reservationUid,
  reservationCode: reservation.reservationCode,
  guestCountLabel: `게스트 ${reservation.guestCount}명`,
  accommodation: {
    id: reservation.accommodation.id,
    name: reservation.accommodation.name,
    thumbnailUrl: reservation.accommodation.thumbnailUrl
      ? resolveImageUrl(reservation.accommodation.thumbnailUrl)
      : null,
  },
  addressLabel: getAddressLabel(reservation),
  checkIn: {
    dateLabel: formatReservationDetailDate(reservation.checkInDateTime),
    timeLabel: formatReservationDetailTime(reservation.checkInTime),
  },
  checkOut: {
    dateLabel: formatReservationDetailDate(reservation.checkOutDateTime),
    timeLabel: formatReservationDetailTime(reservation.checkOutTime),
  },
  host: {
    nickname: reservation.host.nickname,
    displayName: `${reservation.host.nickname} 님`,
    avatarUrl: reservation.host.thumbnailImageUrl
      ? resolveImageUrl(reservation.host.thumbnailImageUrl)
      : null,
    avatarInitial: reservation.host.nickname.charAt(0).toUpperCase(),
  },
  status: {
    label: formatReservationStatus(reservation.status),
    tone: getReservationStatusTone(reservation.status),
  },
  canReview: canCreateReview({
    canWriteReview: reservation.canWriteReview,
    checkOutDateTime: reservation.checkOutDateTime,
    checkOutTime: reservation.checkOutTime,
    status: reservation.status,
  }),
  payment: toReservationPaymentViewModel(reservation.payment),
  mapCoordinate: getMapCoordinate(reservation),
});
