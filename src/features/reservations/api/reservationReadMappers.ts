import type {
  GuestReservationDetail,
  GuestReservationListItem,
  HostReservationDetail,
  HostReservationListItem,
  ReservationAccommodation,
  ReservationAddress,
  ReservationListPage,
  ReservationMember,
  ReservationPageInfo,
  ReservationPayment,
  ReservationStatus,
} from "../model/reservationRead";
import type {
  GuestReservationDetailWire,
  GuestReservationListItemWire,
  GuestReservationPageWire,
  HostReservationDetailWire,
  HostReservationListItemWire,
  HostReservationPageWire,
  ReservationAccommodationWire,
  ReservationAddressWire,
  ReservationMemberWire,
  ReservationPageInfoWire,
  ReservationPaymentWire,
} from "./reservationReadContracts";

const RESERVATION_STATUSES = new Set<ReservationStatus>([
  "PAYMENT_PENDING",
  "PAYMENT_PROCESSING",
  "CONFIRMED",
  "CANCELLATION_PENDING",
  "CANCELLED",
  "CANCELLATION_FAILED",
  "EXPIRED",
]);

const UTC_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?Z$/;

const invalidField = (field: string): never => {
  throw new TypeError(`Reservation read ${field} is invalid.`);
};

const toReservationStatus = (value: unknown): ReservationStatus => {
  if (
    typeof value !== "string" ||
    !RESERVATION_STATUSES.has(value as ReservationStatus)
  ) {
    return invalidField("status");
  }

  return value as ReservationStatus;
};

const toTimeZoneId = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    return invalidField("timeZoneId");
  }

  return value;
};

const toBoolean = (value: unknown, field: string): boolean => {
  if (typeof value !== "boolean") return invalidField(field);
  return value;
};

const isValidCalendarParts = (
  year: number,
  month: number,
  day: number,
): boolean => {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const toInstant = (value: unknown, field: string): string => {
  if (typeof value !== "string") return invalidField(field);

  const match = UTC_INSTANT_PATTERN.exec(value);
  if (!match) return invalidField(field);

  const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
    match;
  if (
    !isValidCalendarParts(
      Number(yearText),
      Number(monthText),
      Number(dayText),
    ) ||
    Number(hourText) > 23 ||
    Number(minuteText) > 59 ||
    Number(secondText) > 59
  ) {
    return invalidField(field);
  }

  return value;
};

const toNullableInstant = (value: unknown, field: string): string | null => {
  if (value === null) return null;
  return toInstant(value, field);
};

const toAccommodation = (
  wire: ReservationAccommodationWire,
): ReservationAccommodation => ({
  id: wire.id,
  name: wire.name,
  thumbnailUrl: wire.thumbnail_url,
});

const toMember = (wire: ReservationMemberWire): ReservationMember => ({
  id: wire.id,
  nickname: wire.nickname,
  thumbnailImageUrl: wire.thumbnail_image_url,
});

const toAddress = (wire: ReservationAddressWire): ReservationAddress => ({
  country: wire.country,
  state: wire.state,
  city: wire.city,
  district: wire.district,
  street: wire.street,
  detail: wire.detail,
  postalCode: wire.postal_code,
});

const toPayment = (
  wire: ReservationPaymentWire | null,
): ReservationPayment | null =>
  wire === null
    ? null
    : {
        orderId: wire.order_id,
        method: wire.method ?? null,
        totalAmount: wire.total_amount,
        balanceAmount: wire.balance_amount ?? null,
        status: wire.status,
        requestedAt: wire.requested_at,
        approvedAt: wire.approved_at ?? null,
        cancels: (wire.cancels ?? []).map((cancel) => ({
          cancelAmount: cancel.cancel_amount,
          cancelReason: cancel.cancel_reason,
          canceledAt: cancel.canceled_at,
        })),
        virtualAccount: wire.virtual_account
          ? {
              accountNumber: wire.virtual_account.account_number,
              bankCode: wire.virtual_account.bank_code,
              customerName: wire.virtual_account.customer_name,
              dueDate: wire.virtual_account.due_date,
            }
          : null,
      };

const toPageInfo = (wire: ReservationPageInfoWire): ReservationPageInfo => ({
  hasNext: wire.has_next,
  nextCursor: wire.next_cursor,
  currentSize: wire.current_size,
});

const toGuestListItem = (
  wire: GuestReservationListItemWire,
): GuestReservationListItem => ({
  audience: "guest",
  reservationId: wire.reservation_id,
  reservationUid: wire.reservation_uid,
  checkInDate: wire.check_in_date,
  checkOutDate: wire.check_out_date,
  timeZoneId: toTimeZoneId(wire.time_zone_id),
  status: toReservationStatus(wire.status),
  createdAt: wire.created_at,
  accommodation: toAccommodation(wire.accommodation),
});

const toHostListItem = (
  wire: HostReservationListItemWire,
): HostReservationListItem => ({
  audience: "host",
  reservationUid: wire.reservation_uid,
  reservationCode: wire.reservation_code,
  totalPrice: wire.total_price,
  currency: wire.currency,
  guestCount: wire.guest_count,
  checkInDate: wire.check_in_date,
  checkOutDate: wire.check_out_date,
  timeZoneId: toTimeZoneId(wire.time_zone_id),
  status: toReservationStatus(wire.status),
  createdAt: wire.created_at,
  guest: toMember(wire.guest),
  accommodation: toAccommodation(wire.accommodation),
});

const assertGuestRecoveryInvariant = ({
  holdExpiresAt,
  paymentAllowed,
  serverTime,
  status,
}: Pick<
  GuestReservationDetail,
  "holdExpiresAt" | "paymentAllowed" | "serverTime" | "status"
>): void => {
  const holdTimestamp =
    holdExpiresAt === null ? null : Date.parse(holdExpiresAt);
  const serverTimestamp = Date.parse(serverTime);

  if (status === "PAYMENT_PENDING") {
    if (
      !paymentAllowed ||
      holdTimestamp === null ||
      holdTimestamp <= serverTimestamp
    ) {
      invalidField("payment recovery state");
    }
    return;
  }

  if (status === "EXPIRED") {
    if (
      paymentAllowed ||
      (holdTimestamp !== null && holdTimestamp > serverTimestamp)
    ) {
      invalidField("payment recovery state");
    }
    return;
  }

  if (paymentAllowed || holdExpiresAt !== null) {
    invalidField("payment recovery state");
  }
};

export const toGuestReservationPage = (
  wire: GuestReservationPageWire,
): ReservationListPage<"guest"> => ({
  audience: "guest",
  reservations: wire.reservations.map(toGuestListItem),
  pageInfo: toPageInfo(wire.page_info),
});

export const toHostReservationPage = (
  wire: HostReservationPageWire,
): ReservationListPage<"host"> => ({
  audience: "host",
  reservations: wire.reservations.map(toHostListItem),
  pageInfo: toPageInfo(wire.page_info),
});

export const toGuestReservationDetail = (
  wire: GuestReservationDetailWire,
): GuestReservationDetail => {
  const detail: GuestReservationDetail = {
    audience: "guest",
    reservationUid: wire.reservation_uid,
    reservationCode: wire.reservation_code,
    status: toReservationStatus(wire.status),
    paymentAllowed: toBoolean(wire.payment_allowed, "paymentAllowed"),
    holdExpiresAt: toNullableInstant(wire.hold_expires_at, "holdExpiresAt"),
    serverTime: toInstant(wire.server_time, "serverTime"),
    createdAt: wire.created_at,
    guestCount: wire.guest_count,
    checkInDateTime: wire.check_in_date_time,
    checkOutDateTime: wire.check_out_date_time,
    timeZoneId: toTimeZoneId(wire.time_zone_id),
    checkInTime: wire.check_in_time,
    checkOutTime: wire.check_out_time,
    canWriteReview: wire.can_write_review,
    accommodation: toAccommodation(wire.accommodation),
    address: toAddress(wire.address),
    coordinate: {
      latitude: wire.coordinate.latitude,
      longitude: wire.coordinate.longitude,
    },
    host: toMember(wire.host),
    payment: toPayment(wire.payment),
  };

  assertGuestRecoveryInvariant(detail);
  return detail;
};

export const toHostReservationDetail = (
  wire: HostReservationDetailWire,
): HostReservationDetail => ({
  audience: "host",
  reservationUid: wire.reservation_uid,
  reservationCode: wire.reservation_code,
  status: toReservationStatus(wire.status),
  createdAt: wire.created_at,
  guestCount: wire.guest_count,
  checkInDateTime: wire.check_in_date_time,
  checkOutDateTime: wire.check_out_date_time,
  timeZoneId: toTimeZoneId(wire.time_zone_id),
  accommodation: toAccommodation(wire.accommodation),
  address: toAddress(wire.address),
  guest: toMember(wire.guest),
  payment: toPayment(wire.payment),
});
