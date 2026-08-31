import type { CheckoutOwnershipWire, PaymentRecordWire } from "./contracts";
import {
  toCheckoutOwnership,
  toPaymentConfirmationWireRequest,
  toPaymentRecord,
} from "./mappers";
import { PAYMENT_STATUSES } from "../model/payment";

const validPaymentWire: PaymentRecordWire = {
  order_id: "reservation-123",
  payment_key: "payment-key-1",
  total_amount: 120000,
  status: "DONE",
};

const validOwnershipWire: CheckoutOwnershipWire = {
  reservation_uid: "reservation-123",
  check_in_date_time: "2026-07-10T15:00:00",
  check_out_date_time: "2026-07-12T11:00:00",
  guest_count: 3,
  accommodation: { id: 7 },
  payment: validPaymentWire,
};

describe("payment contract mappers", () => {
  it.each(PAYMENT_STATUSES)("accepts the known %s payment status", (status) => {
    expect(toPaymentRecord({ ...validPaymentWire, status }).status).toBe(
      status,
    );
  });

  it.each([
    ["empty order identity", { ...validPaymentWire, order_id: " " }],
    ["empty payment identity", { ...validPaymentWire, payment_key: "" }],
    ["zero amount", { ...validPaymentWire, total_amount: 0 }],
    ["negative amount", { ...validPaymentWire, total_amount: -1 }],
    ["fractional amount", { ...validPaymentWire, total_amount: 1.5 }],
    [
      "unsafe amount",
      { ...validPaymentWire, total_amount: Number.MAX_SAFE_INTEGER + 1 },
    ],
    ["unknown status", { ...validPaymentWire, status: "REFUNDED" }],
  ])("rejects a malformed payment wire: %s", (_label, wire) => {
    expect(() => toPaymentRecord(wire)).toThrow(TypeError);
  });

  it("validates confirmation identities and amount before creating the wire body", () => {
    expect(() =>
      toPaymentConfirmationWireRequest({
        paymentKey: " ",
        orderId: "reservation-123",
        amount: 120000,
      }),
    ).toThrow(TypeError);
    expect(() =>
      toPaymentConfirmationWireRequest({
        paymentKey: "payment-key-1",
        orderId: "",
        amount: 120000,
      }),
    ).toThrow(TypeError);
    expect(() =>
      toPaymentConfirmationWireRequest({
        paymentKey: "payment-key-1",
        orderId: "reservation-123",
        amount: Number.NaN,
      }),
    ).toThrow(TypeError);
  });

  it.each([
    ["response reservation mismatch", validOwnershipWire, "reservation-other"],
    [
      "invalid accommodation identity",
      { ...validOwnershipWire, accommodation: { id: 0 } },
      "reservation-123",
    ],
    [
      "invalid guest count",
      { ...validOwnershipWire, guest_count: "3" },
      "reservation-123",
    ],
    [
      "invalid check-in date-time",
      { ...validOwnershipWire, check_in_date_time: " " },
      "reservation-123",
    ],
    [
      "impossible check-in date",
      { ...validOwnershipWire, check_in_date_time: "2026-02-30T15:00:00" },
      "reservation-123",
    ],
    [
      "reversed reservation dates",
      {
        ...validOwnershipWire,
        check_in_date_time: "2026-07-12T15:00:00",
        check_out_date_time: "2026-07-10T11:00:00",
      },
      "reservation-123",
    ],
    [
      "unknown payment shape",
      { ...validOwnershipWire, payment: [] },
      "reservation-123",
    ],
    [
      "payment order mismatch",
      {
        ...validOwnershipWire,
        payment: { ...validPaymentWire, order_id: "reservation-other" },
      },
      "reservation-123",
    ],
  ])("rejects malformed checkout ownership: %s", (_label, wire, expected) => {
    expect(() => toCheckoutOwnership(wire, expected)).toThrow(TypeError);
  });
});
