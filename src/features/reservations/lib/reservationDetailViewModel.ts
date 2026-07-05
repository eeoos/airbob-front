import { PaymentStatus } from "../../../types/enums";
import type { GuestReservationDetail } from "../../../types/reservation";
import { getImageUrl } from "../../../utils/image";
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
  getReservationStatusClassKey,
} from "./reservationStatusDisplay";

type PaymentStatusClassKey = "paid" | "waiting" | "pending";

interface ReservationDateTimeViewModel {
  dateLabel: string;
  timeLabel: string;
}

interface ReservationPaymentViewModel {
  methodLabel: string;
  amountLabel: string;
  approvedAtLabel: string | null;
  statusLabel: string;
  statusClassKey: PaymentStatusClassKey;
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
    classKey: string;
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

const getPaymentStatusClassKey = (
  payment: NonNullable<GuestReservationDetail["payment"]>,
): PaymentStatusClassKey => {
  if (payment.status === PaymentStatus.DONE) {
    return "paid";
  }

  if (
    payment.virtual_account &&
    payment.status === PaymentStatus.WAITING_FOR_DEPOSIT
  ) {
    return "waiting";
  }

  return "pending";
};

const toReservationPaymentViewModel = (
  payment: GuestReservationDetail["payment"],
): ReservationPaymentViewModel | null => {
  if (!payment) return null;

  const isVirtualAccountPending =
    payment.virtual_account &&
    payment.status === PaymentStatus.WAITING_FOR_DEPOSIT;

  return {
    methodLabel: payment.method ?? "-",
    amountLabel: formatNullablePrice(payment.total_amount),
    approvedAtLabel: payment.approved_at
      ? formatKoreanDateTime(payment.approved_at)
      : null,
    statusLabel: formatPaymentStatus(payment.status),
    statusClassKey: getPaymentStatusClassKey(payment),
    virtualAccount: isVirtualAccountPending
      ? {
          bankName: formatBankName(payment.virtual_account?.bank_code),
          accountNumber: payment.virtual_account?.account_number ?? "-",
          customerName: payment.virtual_account?.customer_name ?? "-",
          dueDateLabel: payment.virtual_account?.due_date
            ? formatKoreanDateTime(payment.virtual_account.due_date)
            : "-",
        }
      : null,
  };
};

export const toReservationDetailViewModel = (
  reservation: GuestReservationDetail,
): ReservationDetailViewModel => ({
  reservationUid: reservation.reservation_uid,
  reservationCode: reservation.reservation_code,
  guestCountLabel: `게스트 ${reservation.guest_count}명`,
  accommodation: {
    id: reservation.accommodation.id,
    name: reservation.accommodation.name,
    thumbnailUrl: reservation.accommodation.thumbnail_url
      ? getImageUrl(reservation.accommodation.thumbnail_url)
      : null,
  },
  addressLabel: getAddressLabel(reservation),
  checkIn: {
    dateLabel: formatReservationDetailDate(reservation.check_in_date_time),
    timeLabel: formatReservationDetailTime(reservation.check_in_time),
  },
  checkOut: {
    dateLabel: formatReservationDetailDate(reservation.check_out_date_time),
    timeLabel: formatReservationDetailTime(reservation.check_out_time),
  },
  host: {
    nickname: reservation.host.nickname,
    displayName: `${reservation.host.nickname} 님`,
    avatarUrl: reservation.host.thumbnail_image_url
      ? getImageUrl(reservation.host.thumbnail_image_url)
      : null,
    avatarInitial: reservation.host.nickname.charAt(0).toUpperCase(),
  },
  status: {
    label: formatReservationStatus(reservation.status),
    classKey: getReservationStatusClassKey(reservation.status),
  },
  canReview: canCreateReview({
    can_write_review: reservation.can_write_review,
    check_out_date_time: reservation.check_out_date_time,
    check_out_time: reservation.check_out_time,
    status: reservation.status,
  }),
  payment: toReservationPaymentViewModel(reservation.payment),
  mapCoordinate: getMapCoordinate(reservation),
});
