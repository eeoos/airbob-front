import type { PaymentRecord } from "./payment";

export interface CheckoutOwnership {
  readonly reservationUid: string;
  readonly accommodationId: number;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly guestCount: number;
  readonly payment: PaymentRecord | null;
}
