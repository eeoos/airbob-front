import { reservationApi } from "../../../api";
import { routeTo } from "../../../routes/paths";
import type {
  CreateReservationRequest,
  ReservationReady,
} from "../../../types/reservation";
import { formatCheckoutDateParam } from "./paymentRouteState";
import {
  saveReservationCheckoutState,
  type ReservationCheckoutState,
} from "./reservationCheckoutState";

type CheckoutDateInput = Date | string;

export type ReservationCheckoutHandoffNavigate = (
  to: string,
  options?: { replace?: boolean; state?: unknown }
) => void;

export interface StartReservationCheckoutHandoffOptions {
  accommodationId: number;
  checkIn: CheckoutDateInput;
  checkOut: CheckoutDateInput;
  adultCount: number;
  childCount: number;
  infantCount?: number;
  petCount?: number;
  couponId?: number | null;
  couponName?: string | null;
  couponDiscount?: number | null;
  navigate: ReservationCheckoutHandoffNavigate;
}

export interface ReservationCheckoutHandoffResult {
  reservationResponse: ReservationReady;
  checkoutState: ReservationCheckoutState;
}

const formatCheckoutDateInput = (date: CheckoutDateInput) =>
  typeof date === "string" ? date : formatCheckoutDateParam(date);

const buildReservationCheckoutState = ({
  adultCount,
  childCount,
  checkIn,
  checkOut,
  couponDiscount,
  couponName,
  infantCount = 0,
  petCount = 0,
  reservationResponse,
}: StartReservationCheckoutHandoffOptions & {
  checkIn: string;
  checkOut: string;
  reservationResponse: ReservationReady;
}): ReservationCheckoutState => {
  const appliedCouponDiscount = couponDiscount ?? 0;

  return {
    reservationUid: reservationResponse.reservation_uid,
    orderName: reservationResponse.order_name,
    amount: reservationResponse.amount,
    customerEmail: reservationResponse.customer_email,
    customerName: reservationResponse.customer_name,
    checkIn,
    checkOut,
    adultOccupancy: adultCount,
    childOccupancy: childCount,
    infantOccupancy: infantCount,
    petOccupancy: petCount,
    couponName:
      appliedCouponDiscount > 0 && couponName ? couponName : null,
    couponDiscount: appliedCouponDiscount > 0 ? appliedCouponDiscount : null,
  };
};

const buildReservationCreateRequest = ({
  accommodationId,
  adultCount,
  childCount,
  checkIn,
  checkOut,
  couponDiscount,
  couponId,
}: StartReservationCheckoutHandoffOptions & {
  checkIn: string;
  checkOut: string;
}): CreateReservationRequest => {
  const request: CreateReservationRequest = {
    accommodation_id: accommodationId,
    check_in_date: checkIn,
    check_out_date: checkOut,
    guest_count: adultCount + childCount,
  };

  if (couponId !== undefined) {
    request.coupon_id = (couponDiscount ?? 0) > 0 ? couponId ?? null : null;
  }

  return request;
};

export const startReservationCheckoutHandoff = async (
  options: StartReservationCheckoutHandoffOptions
): Promise<ReservationCheckoutHandoffResult> => {
  const checkIn = formatCheckoutDateInput(options.checkIn);
  const checkOut = formatCheckoutDateInput(options.checkOut);
  const reservationResponse = await reservationApi.create(
    buildReservationCreateRequest({
      ...options,
      checkIn,
      checkOut,
    })
  );
  const checkoutState = buildReservationCheckoutState({
    ...options,
    checkIn,
    checkOut,
    reservationResponse,
  });
  const accommodationId = String(options.accommodationId);

  saveReservationCheckoutState(accommodationId, checkoutState);
  options.navigate(routeTo.accommodationConfirm(accommodationId), {
    state: checkoutState,
  });

  return {
    reservationResponse,
    checkoutState,
  };
};
