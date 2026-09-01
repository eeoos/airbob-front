import type {
  PaymentAttempt,
  PaymentCommandOptions,
  PaymentOperationAccepted,
  PaymentOperationConfirmation,
  PaymentOperationDetail,
  ReservationHoldRelease,
} from "../model/payment";

export interface PaymentOperationApiPort {
  beginPaymentAttempt(
    reservationUid: string,
    options?: PaymentCommandOptions,
  ): Promise<PaymentAttempt>;
  releaseHold(
    reservationUid: string,
    options?: PaymentCommandOptions,
  ): Promise<ReservationHoldRelease>;
  confirmPaymentOperation(
    input: PaymentOperationConfirmation,
    options?: PaymentCommandOptions,
  ): Promise<PaymentOperationAccepted>;
  getPaymentOperation(
    operationId: string,
    expectedOrderId: string,
    options?: PaymentCommandOptions,
  ): Promise<PaymentOperationDetail>;
}
