import { bookingPaymentStateCodec } from "./bookingPaymentStateCodec";

const flowId = "10000000-0000-4000-8000-000000000001";
const reservationUid = "20000000-0000-4000-8000-000000000002";
const operationId = "30000000-0000-4000-8000-000000000003";

describe("bookingPaymentStateCodec", () => {
  it("round-trips exact accommodation and reservation flow locators", () => {
    const accommodation = bookingPaymentStateCodec.serializeFlowReference(
      flowId,
      {
        kind: "accommodation",
        accommodationId: 17,
      },
    );
    const reservation = bookingPaymentStateCodec.serializeFlowReference(
      flowId,
      {
        kind: "reservation",
        reservationUid,
      },
    );

    expect(bookingPaymentStateCodec.parseFlowReference(accommodation)).toEqual(
      accommodation,
    );
    expect(bookingPaymentStateCodec.parseFlowReference(reservation)).toEqual(
      reservation,
    );
  });

  it("round-trips the credential-free operation locator", () => {
    const state = bookingPaymentStateCodec.serializeOperationReference(
      flowId,
      operationId,
      reservationUid,
    );

    expect(bookingPaymentStateCodec.parseOperationReference(state)).toEqual(
      state,
    );
  });

  it.each([
    null,
    {},
    { purpose: "booking-payment-flow-reference" },
    {
      purpose: "booking-payment-flow-reference",
      version: 2,
      flowId: "not-a-uuid",
      locator: { kind: "accommodation", accommodationId: 17 },
    },
    {
      purpose: "booking-payment-flow-reference",
      version: 2,
      flowId,
      locator: { kind: "reservation", reservationUid, extra: true },
    },
    {
      purpose: "booking-payment-flow-reference",
      version: 2,
      flowId,
      locator: { kind: "accommodation", accommodationId: 0 },
    },
  ])("rejects malformed or widened flow state %#", (state) => {
    expect(bookingPaymentStateCodec.parseFlowReference(state)).toBeNull();
  });

  it.each([
    null,
    {},
    {
      purpose: "booking-payment-operation-reference",
      version: 1,
      flowId,
      operationId,
      reservationUid,
    },
    {
      purpose: "booking-payment-operation-reference",
      version: 2,
      flowId,
      operationId: "not-a-uuid",
      reservationUid,
    },
    {
      purpose: "booking-payment-operation-reference",
      version: 2,
      flowId,
      operationId,
      reservationUid,
      paymentKey: "must-not-enter-history",
    },
  ])("rejects malformed or sensitive operation state %#", (state) => {
    expect(bookingPaymentStateCodec.parseOperationReference(state)).toBeNull();
  });

  it("refuses to serialize invalid identifiers", () => {
    expect(
      bookingPaymentStateCodec.serializeFlowReference("bad", {
        kind: "accommodation",
        accommodationId: 1,
      }),
    ).toBeNull();
    expect(
      bookingPaymentStateCodec.serializeOperationReference(
        flowId,
        operationId,
        "bad",
      ),
    ).toBeNull();
  });
});
