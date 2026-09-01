import {
  requestApiData,
  type ApiDataRequest,
} from "../../../../platform/http/request";
import type { PaymentOperationApiPort } from "../ports/paymentApiPort";
import type {
  PaymentAttemptWire,
  PaymentOperationAcceptedWire,
  PaymentOperationDetailWire,
  ReservationHoldReleaseWire,
} from "./contracts";
import {
  toPaymentAttempt,
  toPaymentOperationAccepted,
  toPaymentOperationConfirmationWireRequest,
  toPaymentOperationDetail,
  toPaymentResourceId,
  toReservationHoldRelease,
} from "./mappers";

type PaymentApiTransport = <T>(
  request: ApiDataRequest,
) => Promise<NonNullable<T>>;

const createPaymentApi = (
  request: PaymentApiTransport,
): PaymentOperationApiPort => ({
  async beginPaymentAttempt(reservationUid, options) {
    const validatedReservationUid = toPaymentResourceId(
      reservationUid,
      "reservationUid",
    );
    const wire = await request<PaymentAttemptWire>({
      method: "POST",
      path: `/reservations/${validatedReservationUid}/payment-attempts`,
      signal: options?.signal,
    });

    return toPaymentAttempt(wire, validatedReservationUid);
  },

  async releaseHold(reservationUid, options) {
    const validatedReservationUid = toPaymentResourceId(
      reservationUid,
      "reservationUid",
    );
    const wire = await request<ReservationHoldReleaseWire>({
      method: "DELETE",
      path: `/reservations/${validatedReservationUid}/hold`,
      signal: options?.signal,
    });

    return toReservationHoldRelease(wire, validatedReservationUid);
  },

  async confirmPaymentOperation(input, options) {
    const wire = await request<PaymentOperationAcceptedWire>({
      method: "POST",
      path: "/payments/confirm",
      expectedSuccessStatus: 202,
      body: toPaymentOperationConfirmationWireRequest(input),
      signal: options?.signal,
    });

    return toPaymentOperationAccepted(wire);
  },

  async getPaymentOperation(operationId, expectedOrderId, options) {
    const validatedOperationId = toPaymentResourceId(
      operationId,
      "operationId",
    );
    const validatedOrderId = toPaymentResourceId(
      expectedOrderId,
      "expectedOrderId",
    );
    const wire = await request<PaymentOperationDetailWire>({
      method: "GET",
      path: `/payment-operations/${validatedOperationId}`,
      signal: options?.signal,
    });

    return toPaymentOperationDetail(
      wire,
      validatedOperationId,
      validatedOrderId,
    );
  },
});

export const paymentApi = createPaymentApi(requestApiData);
