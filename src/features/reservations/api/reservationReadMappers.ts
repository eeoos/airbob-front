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
        paymentKey: wire.payment_key ?? null,
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
  status: wire.status,
  createdAt: wire.created_at,
  guest: toMember(wire.guest),
  accommodation: toAccommodation(wire.accommodation),
});

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
): GuestReservationDetail => ({
  audience: "guest",
  reservationUid: wire.reservation_uid,
  reservationCode: wire.reservation_code,
  status: wire.status,
  createdAt: wire.created_at,
  guestCount: wire.guest_count,
  checkInDateTime: wire.check_in_date_time,
  checkOutDateTime: wire.check_out_date_time,
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
});

export const toHostReservationDetail = (
  wire: HostReservationDetailWire,
): HostReservationDetail => ({
  audience: "host",
  reservationUid: wire.reservation_uid,
  reservationCode: wire.reservation_code,
  status: wire.status,
  createdAt: wire.created_at,
  guestCount: wire.guest_count,
  checkInDateTime: wire.check_in_date_time,
  checkOutDateTime: wire.check_out_date_time,
  accommodation: toAccommodation(wire.accommodation),
  address: toAddress(wire.address),
  guest: toMember(wire.guest),
  payment: toPayment(wire.payment),
});
