type BookingPaymentFlowLocator =
  | {
      readonly kind: "accommodation";
      readonly accommodationId: number;
    }
  | {
      readonly kind: "reservation";
      readonly reservationUid: string;
    };

export interface BookingPaymentFlowReferenceState {
  readonly purpose: "booking-payment-flow-reference";
  readonly version: 2;
  readonly flowId: string;
  readonly locator: BookingPaymentFlowLocator;
}

export interface BookingPaymentOperationReferenceState {
  readonly purpose: "booking-payment-operation-reference";
  readonly version: 2;
  readonly flowId: string;
  readonly operationId: string;
  readonly reservationUid: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean => {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
};

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

const isFlowLocator = (value: unknown): value is BookingPaymentFlowLocator => {
  if (!isRecord(value)) return false;
  if (value.kind === "accommodation") {
    return (
      hasExactKeys(value, ["kind", "accommodationId"]) &&
      isPositiveInteger(value.accommodationId)
    );
  }
  return (
    value.kind === "reservation" &&
    hasExactKeys(value, ["kind", "reservationUid"]) &&
    isUuid(value.reservationUid)
  );
};

const parseFlowReference = (
  value: unknown,
): BookingPaymentFlowReferenceState | null => {
  const reference = value;
  if (
    !isRecord(reference) ||
    !hasExactKeys(reference, ["purpose", "version", "flowId", "locator"]) ||
    reference.purpose !== "booking-payment-flow-reference" ||
    reference.version !== 2 ||
    !isUuid(reference.flowId) ||
    !isFlowLocator(reference.locator)
  ) {
    return null;
  }
  return {
    purpose: reference.purpose,
    version: reference.version,
    flowId: reference.flowId,
    locator: reference.locator,
  };
};

const parseOperationReference = (
  value: unknown,
): BookingPaymentOperationReferenceState | null => {
  const reference = value;
  if (
    !isRecord(reference) ||
    !hasExactKeys(reference, [
      "purpose",
      "version",
      "flowId",
      "operationId",
      "reservationUid",
    ]) ||
    reference.purpose !== "booking-payment-operation-reference" ||
    reference.version !== 2 ||
    !isUuid(reference.flowId) ||
    !isUuid(reference.operationId) ||
    !isUuid(reference.reservationUid)
  ) {
    return null;
  }
  return {
    purpose: reference.purpose,
    version: reference.version,
    flowId: reference.flowId,
    operationId: reference.operationId,
    reservationUid: reference.reservationUid,
  };
};

const createBookingPaymentFlowReferenceState = (
  flowId: string,
  locator: BookingPaymentFlowLocator,
): BookingPaymentFlowReferenceState | null => {
  const state = {
    purpose: "booking-payment-flow-reference" as const,
    version: 2 as const,
    flowId,
    locator,
  };
  return parseFlowReference(state) ? state : null;
};

const createBookingPaymentOperationReferenceState = (
  flowId: string,
  operationId: string,
  reservationUid: string,
): BookingPaymentOperationReferenceState | null => {
  const state = {
    purpose: "booking-payment-operation-reference" as const,
    version: 2 as const,
    flowId,
    operationId,
    reservationUid,
  };
  return parseOperationReference(state) ? state : null;
};

export const bookingPaymentStateCodec = {
  parseFlowReference,
  parseOperationReference,
  serializeFlowReference: createBookingPaymentFlowReferenceState,
  serializeOperationReference: createBookingPaymentOperationReferenceState,
} as const;
