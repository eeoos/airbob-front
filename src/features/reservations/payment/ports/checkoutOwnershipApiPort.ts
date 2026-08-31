import type { CheckoutOwnership } from "../model/checkoutOwnership";
import type { PaymentCommandOptions } from "../model/payment";

export interface CheckoutOwnershipApiPort {
  getCheckoutOwnership(
    reservationUid: string,
    options?: PaymentCommandOptions,
  ): Promise<CheckoutOwnership>;
}
