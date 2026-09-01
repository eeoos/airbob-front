import { bookingPaymentStorageDriver } from "../../../platform/storage/bookingPaymentStorageDriver";
import type { SessionStorageDriver } from "../../../platform/storage/sessionStorageDriver";
import type {
  BookingPaymentCandidateReconciliationResult,
  BookingPaymentJournalAcknowledgeResult,
  BookingPaymentJournalData,
  BookingPaymentJournalEnvelope,
  BookingPaymentJournalPhase,
  BookingPaymentJournalReadResult,
  BookingPaymentJournalWriteResult,
  BookingPaymentNamespaceInspectionResult,
  BookingPaymentPresentationIntent,
  BookingPaymentQuote,
  BookingPaymentRecoveryLocator,
  BookingPaymentRuntimeLease,
  BookingPaymentServerIntent,
  BookingPaymentUnheldFlowCloseReason,
  BookingPaymentUnheldFlowCloseResult,
} from "./types";
import { reconcileBookingPaymentCandidateOwner } from "./candidateReconciliation";
import {
  BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS,
  isAllowedBookingPaymentJournalTransition,
  isBookingPaymentJournalData,
  isBookingPaymentJournalEnvelope,
  isBookingPaymentRuntimeLease,
  isBookingPaymentTerminalPhase,
  isExactBookingPaymentJournalData,
  parseBookingPaymentJournalEnvelope,
  parseBookingPaymentUtcInstant,
  preservesBookingPaymentJournalImmutableGroups,
} from "./validation";
import {
  BOOKING_PAYMENT_V2_JOURNAL_KEY,
  BOOKING_PAYMENT_V2_NAMESPACE_PREFIX,
} from "./namespace";

interface BookingPaymentStorageOptions {
  readonly driver?: SessionStorageDriver;
}

interface BookingPaymentJournalRepositoryOptions extends BookingPaymentStorageOptions {
  readonly now?: () => number;
}

interface CreateQuotedInput {
  readonly owner: string;
  readonly lease: BookingPaymentRuntimeLease;
  readonly flowId: string;
  readonly serverIntent: BookingPaymentServerIntent;
  readonly presentationIntent: BookingPaymentPresentationIntent;
  readonly quote: BookingPaymentQuote;
  readonly isCurrent: () => boolean;
}

interface BookingPaymentJournalAuthorityInput {
  readonly owner: string;
  readonly lease: BookingPaymentRuntimeLease;
  readonly flowId: string;
  readonly locator: BookingPaymentRecoveryLocator;
  readonly isCurrent: () => boolean;
}

interface ReplaceExpectedPhaseInput extends BookingPaymentJournalAuthorityInput {
  readonly expectedPhase: BookingPaymentJournalPhase;
  /**
   * The repository owns recoveryExpiresAt and replaces the supplied value with
   * the current phase's non-sliding, server-relative deadline.
   */
  readonly nextData: BookingPaymentJournalData;
}

interface ClaimRecoveryLeaseInput {
  readonly owner: string;
  readonly flowId: string;
  readonly locator: BookingPaymentRecoveryLocator;
  readonly lease: BookingPaymentRuntimeLease;
  readonly isCurrent: () => boolean;
}

interface AcknowledgeTerminalInput extends BookingPaymentJournalAuthorityInput {
  readonly expectedPhase: BookingPaymentJournalPhase;
}

interface CloseUnheldFlowInput extends BookingPaymentJournalAuthorityInput {
  readonly closeReason: BookingPaymentUnheldFlowCloseReason;
}

interface BookingPaymentJournalRepository {
  read(
    input: BookingPaymentJournalAuthorityInput,
  ): BookingPaymentJournalReadResult;
  reconcileCandidateOwner(
    owner: string,
  ): BookingPaymentCandidateReconciliationResult;
  claimRecoveryLease(
    input: ClaimRecoveryLeaseInput,
  ): BookingPaymentJournalWriteResult;
  createQuoted(input: CreateQuotedInput): BookingPaymentJournalWriteResult;
  replaceExpectedPhase(
    input: ReplaceExpectedPhaseInput,
  ): BookingPaymentJournalWriteResult;
  acknowledgeTerminal(
    input: AcknowledgeTerminalInput,
  ): BookingPaymentJournalAcknowledgeResult;
  closeUnheldFlow(
    input: CloseUnheldFlowInput,
  ): BookingPaymentUnheldFlowCloseResult;
}

const safeCurrentTime = (now: () => number): number | null => {
  try {
    const value = now();
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
};

const safeIsCurrent = (isCurrent: () => boolean): boolean => {
  try {
    return isCurrent();
  } catch {
    return false;
  }
};

const exactJsonEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const exactLease = (
  left: BookingPaymentRuntimeLease,
  right: BookingPaymentRuntimeLease,
): boolean =>
  left.runtimeLeaseId === right.runtimeLeaseId &&
  left.sessionEpoch === right.sessionEpoch;

/**
 * Downgrade fence for the still-active legacy writer. This capability is
 * intentionally enumerate-only: a previous build cannot interpret or own any
 * payload in the newer namespace.
 */
export const inspectBookingPaymentV2NamespaceForLegacyWriter = ({
  driver = bookingPaymentStorageDriver,
}: BookingPaymentStorageOptions = {}): BookingPaymentNamespaceInspectionResult => {
  const keys = driver.keys();
  if (!keys.ok) {
    return {
      status: "blocked",
      reason: "storage-error",
      error: keys.error,
    };
  }

  return keys.value.some((key) =>
    key.startsWith(BOOKING_PAYMENT_V2_NAMESPACE_PREFIX),
  )
    ? { status: "blocked", reason: "v2-state-present" }
    : { status: "ready" };
};

const readCurrentJournal = (
  driver: SessionStorageDriver,
  now: () => number,
  owner: string,
): BookingPaymentJournalReadResult => {
  const raw = driver.getItem(BOOKING_PAYMENT_V2_JOURNAL_KEY);
  if (!raw.ok) return { status: "storage-error", error: raw.error };
  if (raw.value === null) return { status: "missing" };

  const record = parseBookingPaymentJournalEnvelope(raw.value);
  if (!record) return { status: "rejected", reason: "malformed" };
  if (record.owner !== owner) {
    return { status: "rejected", reason: "foreign-owner" };
  }

  const currentTime = safeCurrentTime(now);
  if (currentTime === null) {
    return { status: "rejected", reason: "invalid-clock" };
  }
  if (
    currentTime >= record.hardExpiresAt ||
    currentTime >= record.data.recoveryExpiresAt
  ) {
    return { status: "rejected", reason: "expired" };
  }

  return { status: "found", record };
};

const mapReadRejectionToWrite = (
  result: Exclude<
    BookingPaymentJournalReadResult,
    { readonly status: "found" }
  >,
): BookingPaymentJournalWriteResult => {
  switch (result.status) {
    case "missing":
      return { status: "rejected", reason: "missing-journal" };
    case "stale":
      return result;
    case "rejected":
      return result;
    case "storage-error":
      return result;
  }
};

const serializeRecord = (
  record: BookingPaymentJournalEnvelope,
): string | null => {
  try {
    return JSON.stringify(record);
  } catch {
    return null;
  }
};

const writeAndVerify = (
  driver: SessionStorageDriver,
  record: BookingPaymentJournalEnvelope,
  isCurrent: () => boolean,
): BookingPaymentJournalWriteResult => {
  if (!isBookingPaymentJournalEnvelope(record)) {
    return { status: "rejected", reason: "invalid-data" };
  }
  const raw = serializeRecord(record);
  if (raw === null) {
    return { status: "rejected", reason: "serialization-error" };
  }

  if (!safeIsCurrent(isCurrent)) return { status: "stale" };
  const written = driver.setItem(BOOKING_PAYMENT_V2_JOURNAL_KEY, raw);
  if (!written.ok) return { status: "storage-error", error: written.error };

  const readBack = driver.getItem(BOOKING_PAYMENT_V2_JOURNAL_KEY);
  if (!readBack.ok) {
    return { status: "storage-error", error: readBack.error };
  }
  if (readBack.value !== raw) {
    return { status: "rejected", reason: "write-not-verified" };
  }
  const verified = parseBookingPaymentJournalEnvelope(readBack.value);
  if (!verified || !exactJsonEqual(verified, record)) {
    return { status: "rejected", reason: "write-not-verified" };
  }
  if (!safeIsCurrent(isCurrent)) return { status: "stale" };
  return { status: "written", record: verified };
};

type BookingPaymentCreateNamespacePreparationResult =
  | { readonly status: "ready"; readonly currentTime: number }
  | { readonly status: "stale" }
  | {
      readonly status: "rejected";
      readonly reason:
        | "active-journal"
        | "foreign-journal"
        | "opaque-v2-state"
        | "cleanup-not-verified"
        | "invalid-clock";
    }
  | {
      readonly status: "storage-error";
      readonly error: {
        readonly kind: "storage-unavailable";
        readonly operation: "get" | "set" | "remove" | "keys";
      };
    };

const prepareNamespaceForCreate = (
  driver: SessionStorageDriver,
  now: () => number,
  owner: string,
  isCurrent: () => boolean,
): BookingPaymentCreateNamespacePreparationResult => {
  if (!safeIsCurrent(isCurrent)) return { status: "stale" };
  const currentTime = safeCurrentTime(now);
  if (currentTime === null) {
    return { status: "rejected", reason: "invalid-clock" };
  }

  const keys = driver.keys();
  if (!keys.ok) return { status: "storage-error", error: keys.error };
  const v2Keys = keys.value.filter((key) =>
    key.startsWith(BOOKING_PAYMENT_V2_NAMESPACE_PREFIX),
  );
  if (v2Keys.length === 0) {
    return safeIsCurrent(isCurrent)
      ? { status: "ready", currentTime }
      : { status: "stale" };
  }
  if (v2Keys.length !== 1 || v2Keys[0] !== BOOKING_PAYMENT_V2_JOURNAL_KEY) {
    return { status: "rejected", reason: "opaque-v2-state" };
  }

  const raw = driver.getItem(BOOKING_PAYMENT_V2_JOURNAL_KEY);
  if (!raw.ok) return { status: "storage-error", error: raw.error };
  if (raw.value === null) {
    const verified = driver.keys();
    if (!verified.ok) {
      return { status: "storage-error", error: verified.error };
    }
    if (
      verified.value.some((key) =>
        key.startsWith(BOOKING_PAYMENT_V2_NAMESPACE_PREFIX),
      )
    ) {
      return { status: "rejected", reason: "opaque-v2-state" };
    }
    return safeIsCurrent(isCurrent)
      ? { status: "ready", currentTime }
      : { status: "stale" };
  }

  const record = parseBookingPaymentJournalEnvelope(raw.value);
  if (!record) {
    return { status: "rejected", reason: "opaque-v2-state" };
  }
  if (record.owner !== owner) {
    return { status: "rejected", reason: "foreign-journal" };
  }
  if (
    currentTime < record.hardExpiresAt &&
    currentTime < record.data.recoveryExpiresAt
  ) {
    return { status: "rejected", reason: "active-journal" };
  }

  if (!safeIsCurrent(isCurrent)) return { status: "stale" };
  const removed = driver.removeItem(BOOKING_PAYMENT_V2_JOURNAL_KEY);
  if (!removed.ok) return { status: "storage-error", error: removed.error };
  const verified = driver.keys();
  if (!verified.ok) {
    return { status: "storage-error", error: verified.error };
  }
  if (
    verified.value.some((key) =>
      key.startsWith(BOOKING_PAYMENT_V2_NAMESPACE_PREFIX),
    )
  ) {
    return { status: "rejected", reason: "cleanup-not-verified" };
  }
  return safeIsCurrent(isCurrent)
    ? { status: "ready", currentTime }
    : { status: "stale" };
};

const locatorMatches = (
  data: BookingPaymentJournalData,
  locator: BookingPaymentRecoveryLocator,
): boolean => {
  if ("ready" in data) {
    return (
      locator.kind === "reservation" &&
      locator.reservationUid === data.ready.reservationUid
    );
  }
  return (
    locator.kind === "accommodation" &&
    locator.accommodationId === data.serverIntent.accommodationId
  );
};

const isBookingPaymentUnheldFlowCloseReason = (
  value: unknown,
): value is BookingPaymentUnheldFlowCloseReason => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (record.type === "quote-abandoned") {
    return keys.length === 1 && keys[0] === "type";
  }
  return (
    record.type === "checkout-definitively-rejected" &&
    keys.length === 2 &&
    keys[0] === "code" &&
    keys[1] === "type" &&
    (record.code === "R017" || record.code === "R018" || record.code === "R019")
  );
};

const closeReasonMatchesPhase = (
  closeReason: BookingPaymentUnheldFlowCloseReason,
  phase: BookingPaymentJournalPhase,
): boolean =>
  closeReason.type === "quote-abandoned"
    ? phase === "quoted" || phase === "checkout-prepared"
    : phase === "checkout-submitting";

const readWithAuthority = (
  driver: SessionStorageDriver,
  now: () => number,
  input: BookingPaymentJournalAuthorityInput,
): BookingPaymentJournalReadResult => {
  if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
  const current = readCurrentJournal(driver, now, input.owner);
  if (current.status !== "found") return current;
  if (!exactLease(current.record.lease, input.lease)) {
    return { status: "rejected", reason: "stale-lease" };
  }
  if (current.record.data.flowId !== input.flowId) {
    return { status: "rejected", reason: "flow-mismatch" };
  }
  if (!locatorMatches(current.record.data, input.locator)) {
    return { status: "rejected", reason: "locator-mismatch" };
  }
  return safeIsCurrent(input.isCurrent) ? current : { status: "stale" };
};

const serverRelativeDeadline = (
  localTransitionTime: number,
  serverTime: string,
  serverExpiry: string,
  hardExpiresAt: number,
): number | null => {
  const parsedServerTime = parseBookingPaymentUtcInstant(serverTime);
  const parsedServerExpiry = parseBookingPaymentUtcInstant(serverExpiry);
  if (parsedServerTime === null || parsedServerExpiry === null) return null;
  const remaining = Math.max(0, parsedServerExpiry - parsedServerTime);
  const candidate = localTransitionTime + remaining;
  return Number.isSafeInteger(candidate)
    ? Math.min(hardExpiresAt, candidate)
    : null;
};

const recoveryDeadlineForTransition = (
  current: BookingPaymentJournalEnvelope,
  next: BookingPaymentJournalData,
  currentTime: number,
): number | null => {
  switch (next.phase) {
    case "checkout-submitting":
    case "complimentary-observed":
    case "reservation-status-observed":
      return current.hardExpiresAt;
    case "reservation-ready":
      return next.ready.holdExpiresAt === null
        ? null
        : serverRelativeDeadline(
            currentTime,
            next.ready.serverTime,
            next.ready.holdExpiresAt,
            current.hardExpiresAt,
          );
    case "attempt-ready":
      return serverRelativeDeadline(
        currentTime,
        next.attempt.serverTime,
        next.attempt.holdExpiresAt,
        current.hardExpiresAt,
      );
    default:
      return current.data.recoveryExpiresAt;
  }
};

/** @public Intentional B1 repository capability consumed at the B1b lease fence. */
export const createBookingPaymentJournalRepository = ({
  driver = bookingPaymentStorageDriver,
  now = Date.now,
}: BookingPaymentJournalRepositoryOptions = {}): BookingPaymentJournalRepository => {
  const read = (
    input: BookingPaymentJournalAuthorityInput,
  ): BookingPaymentJournalReadResult => readWithAuthority(driver, now, input);

  const reconcileCandidateOwner = (
    owner: string,
  ): BookingPaymentCandidateReconciliationResult =>
    reconcileBookingPaymentCandidateOwner({ driver, now, owner });

  const claimRecoveryLease = (
    input: ClaimRecoveryLeaseInput,
  ): BookingPaymentJournalWriteResult => {
    if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
    if (!isBookingPaymentRuntimeLease(input.lease)) {
      return { status: "rejected", reason: "invalid-data" };
    }
    const current = readCurrentJournal(driver, now, input.owner);
    if (current.status !== "found") return mapReadRejectionToWrite(current);
    if (current.record.data.flowId !== input.flowId) {
      return { status: "rejected", reason: "flow-mismatch" };
    }
    if (!locatorMatches(current.record.data, input.locator)) {
      return { status: "rejected", reason: "locator-mismatch" };
    }
    if (exactLease(current.record.lease, input.lease)) {
      return safeIsCurrent(input.isCurrent)
        ? { status: "unchanged" }
        : { status: "stale" };
    }
    return writeAndVerify(
      driver,
      { ...current.record, lease: input.lease },
      input.isCurrent,
    );
  };

  const createQuoted = (
    input: CreateQuotedInput,
  ): BookingPaymentJournalWriteResult => {
    const namespace = prepareNamespaceForCreate(
      driver,
      now,
      input.owner,
      input.isCurrent,
    );
    if (namespace.status !== "ready") return namespace;
    const { currentTime } = namespace;

    const hardExpiresAt = currentTime + BOOKING_PAYMENT_JOURNAL_HARD_TTL_MS;
    const recoveryExpiresAt = serverRelativeDeadline(
      currentTime,
      input.quote.serverTime,
      input.quote.quoteExpiresAt,
      hardExpiresAt,
    );
    if (recoveryExpiresAt === null || recoveryExpiresAt <= currentTime) {
      return { status: "rejected", reason: "invalid-data" };
    }
    const data: BookingPaymentJournalData = {
      phase: "quoted",
      flowId: input.flowId,
      serverIntent: input.serverIntent,
      presentationIntent: input.presentationIntent,
      recoveryExpiresAt,
      quote: input.quote,
    };
    const record: BookingPaymentJournalEnvelope = {
      purpose: "booking-payment-journal",
      version: 2,
      privacyClass: "sensitive",
      containsPii: false,
      owner: input.owner,
      createdAt: currentTime,
      hardExpiresAt,
      lease: input.lease,
      data,
    };
    return writeAndVerify(driver, record, input.isCurrent);
  };

  const replaceExpectedPhase = (
    input: ReplaceExpectedPhaseInput,
  ): BookingPaymentJournalWriteResult => {
    const current = read(input);
    if (current.status !== "found") return mapReadRejectionToWrite(current);
    if (isExactBookingPaymentJournalData(current.record.data, input.nextData)) {
      return safeIsCurrent(input.isCurrent)
        ? { status: "unchanged" }
        : { status: "stale" };
    }
    if (current.record.data.phase !== input.expectedPhase) {
      return { status: "rejected", reason: "phase-mismatch" };
    }
    if (input.nextData.flowId !== current.record.data.flowId) {
      return { status: "rejected", reason: "flow-mismatch" };
    }
    if (
      !isBookingPaymentJournalData(input.nextData) ||
      !isAllowedBookingPaymentJournalTransition(
        current.record.data,
        input.nextData,
      )
    ) {
      return { status: "rejected", reason: "illegal-transition" };
    }
    if (
      !preservesBookingPaymentJournalImmutableGroups(
        current.record.data,
        input.nextData,
      )
    ) {
      return { status: "rejected", reason: "immutable-group-change" };
    }

    const currentTime = safeCurrentTime(now);
    if (currentTime === null) {
      return { status: "rejected", reason: "invalid-clock" };
    }
    const recoveryExpiresAt = recoveryDeadlineForTransition(
      current.record,
      input.nextData,
      currentTime,
    );
    if (
      recoveryExpiresAt === null ||
      recoveryExpiresAt <= currentTime ||
      recoveryExpiresAt > current.record.hardExpiresAt
    ) {
      return { status: "rejected", reason: "invalid-data" };
    }
    const nextData = {
      ...input.nextData,
      recoveryExpiresAt,
    } as BookingPaymentJournalData;
    if (!isBookingPaymentJournalData(nextData)) {
      return { status: "rejected", reason: "invalid-data" };
    }
    return writeAndVerify(
      driver,
      { ...current.record, data: nextData },
      input.isCurrent,
    );
  };

  const acknowledgeTerminal = (
    input: AcknowledgeTerminalInput,
  ): BookingPaymentJournalAcknowledgeResult => {
    const current = read(input);
    if (current.status === "missing") return current;
    if (current.status === "stale") return current;
    if (current.status === "storage-error") return current;
    if (current.status === "rejected") return current;
    if (current.record.data.phase !== input.expectedPhase) {
      return { status: "rejected", reason: "phase-mismatch" };
    }
    if (!isBookingPaymentTerminalPhase(current.record.data.phase)) {
      return { status: "rejected", reason: "not-terminal" };
    }

    if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
    const removed = driver.removeItem(BOOKING_PAYMENT_V2_JOURNAL_KEY);
    if (!removed.ok) return { status: "storage-error", error: removed.error };
    const verified = driver.getItem(BOOKING_PAYMENT_V2_JOURNAL_KEY);
    if (!verified.ok) {
      return { status: "storage-error", error: verified.error };
    }
    if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };
    return verified.value === null
      ? { status: "cleared" }
      : { status: "rejected", reason: "remove-not-verified" };
  };

  const closeUnheldFlow = (
    input: CloseUnheldFlowInput,
  ): BookingPaymentUnheldFlowCloseResult => {
    if (!isBookingPaymentUnheldFlowCloseReason(input.closeReason)) {
      return { status: "rejected", reason: "invalid-close-reason" };
    }
    if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };

    const initialKeys = driver.keys();
    if (!initialKeys.ok) {
      return { status: "storage-error", error: initialKeys.error };
    }
    const initialV2Keys = initialKeys.value.filter((key) =>
      key.startsWith(BOOKING_PAYMENT_V2_NAMESPACE_PREFIX),
    );
    if (initialV2Keys.length === 0) {
      return { status: "rejected", reason: "missing-journal" };
    }
    if (
      initialV2Keys.length !== 1 ||
      initialV2Keys[0] !== BOOKING_PAYMENT_V2_JOURNAL_KEY
    ) {
      return { status: "rejected", reason: "opaque-v2-state" };
    }

    const current = read(input);
    if (current.status === "missing") {
      return { status: "rejected", reason: "missing-journal" };
    }
    if (current.status !== "found") return current;
    if (
      !closeReasonMatchesPhase(input.closeReason, current.record.data.phase)
    ) {
      return { status: "rejected", reason: "phase-mismatch" };
    }

    const beforeRemovalKeys = driver.keys();
    if (!beforeRemovalKeys.ok) {
      return { status: "storage-error", error: beforeRemovalKeys.error };
    }
    const beforeRemovalV2Keys = beforeRemovalKeys.value.filter((key) =>
      key.startsWith(BOOKING_PAYMENT_V2_NAMESPACE_PREFIX),
    );
    if (
      beforeRemovalV2Keys.length !== 1 ||
      beforeRemovalV2Keys[0] !== BOOKING_PAYMENT_V2_JOURNAL_KEY
    ) {
      return { status: "rejected", reason: "opaque-v2-state" };
    }
    if (!safeIsCurrent(input.isCurrent)) return { status: "stale" };

    const removed = driver.removeItem(BOOKING_PAYMENT_V2_JOURNAL_KEY);
    if (!removed.ok) return { status: "storage-error", error: removed.error };
    const verified = driver.keys();
    if (!verified.ok) {
      return { status: "storage-error", error: verified.error };
    }
    if (
      verified.value.some((key) =>
        key.startsWith(BOOKING_PAYMENT_V2_NAMESPACE_PREFIX),
      )
    ) {
      return { status: "rejected", reason: "remove-not-verified" };
    }
    return safeIsCurrent(input.isCurrent)
      ? { status: "cleared" }
      : { status: "stale" };
  };

  return {
    read,
    reconcileCandidateOwner,
    claimRecoveryLease,
    createQuoted,
    replaceExpectedPhase,
    acknowledgeTerminal,
    closeUnheldFlow,
  };
};
