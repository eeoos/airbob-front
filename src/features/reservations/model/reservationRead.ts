export type ReservationReadAudience = "guest" | "host";
export type ReservationFilterType = "UPCOMING" | "PAST" | "CANCELLED";

export type ReservationStatus =
  | "PAYMENT_PENDING"
  | "PAYMENT_PROCESSING"
  | "CONFIRMED"
  | "CANCELLATION_PENDING"
  | "CANCELLED"
  | "CANCELLATION_FAILED"
  | "EXPIRED";

export type ReservationPaymentStatus =
  | "READY"
  | "IN_PROGRESS"
  | "WAITING_FOR_DEPOSIT"
  | "DONE"
  | "CANCELED"
  | "PARTIAL_CANCELED"
  | "ABORTED"
  | "EXPIRED";

export interface ReservationAccommodation {
  readonly id: number;
  readonly name: string;
  readonly thumbnailUrl: string | null;
}

export interface ReservationMember {
  readonly id: number;
  readonly nickname: string;
  readonly thumbnailImageUrl: string | null;
}

export interface ReservationAddress {
  readonly country: string;
  readonly state: string | null;
  readonly city: string;
  readonly district: string | null;
  readonly street: string;
  readonly detail: string | null;
  readonly postalCode: string;
}

interface ReservationCoordinate {
  readonly latitude: number | null;
  readonly longitude: number | null;
}

interface ReservationPaymentCancel {
  readonly cancelAmount: number;
  readonly cancelReason: string;
  readonly canceledAt: string;
}

interface ReservationVirtualAccount {
  readonly accountNumber: string;
  readonly bankCode: string;
  readonly customerName: string;
  readonly dueDate: string;
}

export interface ReservationPayment {
  readonly orderId: string;
  readonly method: string | null;
  readonly totalAmount: number;
  readonly balanceAmount: number | null;
  readonly status: ReservationPaymentStatus;
  readonly requestedAt: string;
  readonly approvedAt: string | null;
  readonly cancels: readonly ReservationPaymentCancel[];
  readonly virtualAccount: ReservationVirtualAccount | null;
}

export interface ReservationPageInfo {
  readonly hasNext: boolean;
  readonly nextCursor: string | null;
  readonly currentSize: number;
}

export interface GuestReservationListItem {
  readonly audience: "guest";
  readonly reservationId: number;
  readonly reservationUid: string;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly timeZoneId: string;
  readonly status: ReservationStatus;
  readonly createdAt: string;
  readonly accommodation: ReservationAccommodation;
}

export interface HostReservationListItem {
  readonly audience: "host";
  readonly reservationUid: string;
  readonly reservationCode: string;
  readonly totalPrice: number;
  readonly currency: string;
  readonly guestCount: number;
  readonly checkInDate: string;
  readonly checkOutDate: string;
  readonly timeZoneId: string;
  readonly status: ReservationStatus;
  readonly createdAt: string;
  readonly guest: ReservationMember;
  readonly accommodation: ReservationAccommodation;
}

type ReservationListItemByAudience<TAudience extends ReservationReadAudience> =
  TAudience extends "guest"
    ? GuestReservationListItem
    : HostReservationListItem;

export interface ReservationListPage<
  TAudience extends ReservationReadAudience = ReservationReadAudience,
> {
  readonly audience: TAudience;
  readonly reservations: readonly ReservationListItemByAudience<TAudience>[];
  readonly pageInfo: ReservationPageInfo;
}

interface ReservationDetailBase<TAudience extends ReservationReadAudience> {
  readonly audience: TAudience;
  readonly reservationUid: string;
  readonly reservationCode: string;
  readonly status: ReservationStatus;
  readonly createdAt: string;
  readonly guestCount: number;
  readonly checkInDateTime: string;
  readonly checkOutDateTime: string;
  readonly timeZoneId: string;
  readonly accommodation: ReservationAccommodation;
  readonly address: ReservationAddress;
  readonly payment: ReservationPayment | null;
}

export interface GuestReservationDetail extends ReservationDetailBase<"guest"> {
  readonly paymentAllowed: boolean;
  readonly holdExpiresAt: string | null;
  readonly serverTime: string;
  readonly checkInTime: string;
  readonly checkOutTime: string;
  readonly canWriteReview: boolean;
  readonly coordinate: ReservationCoordinate;
  readonly host: ReservationMember;
}

export interface HostReservationDetail extends ReservationDetailBase<"host"> {
  readonly guest: ReservationMember;
}

export type ReservationDetailByAudience<
  TAudience extends ReservationReadAudience,
> = TAudience extends "guest" ? GuestReservationDetail : HostReservationDetail;
