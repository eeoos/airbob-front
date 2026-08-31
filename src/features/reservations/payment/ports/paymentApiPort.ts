import type {
  PaymentCommandOptions,
  PaymentConfirmation,
  PaymentRecord,
} from "../model/payment";

export interface PaymentApiPort {
  confirm(
    input: PaymentConfirmation,
    options?: PaymentCommandOptions,
  ): Promise<void>;
  getByPaymentKey(
    paymentKey: string,
    options?: PaymentCommandOptions,
  ): Promise<PaymentRecord>;
  getByOrderId(
    orderId: string,
    options?: PaymentCommandOptions,
  ): Promise<PaymentRecord>;
}
