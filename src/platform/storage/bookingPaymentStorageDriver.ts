import { sessionStorageDriver } from "./sessionStorageDriver";

/**
 * Named platform capability for the booking-payment aggregate. The workflow
 * may accept an injected driver for tests, but it never imports the generic
 * raw browser driver directly.
 */
export const bookingPaymentStorageDriver = sessionStorageDriver;
