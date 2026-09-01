import type {
  ReservationCreateApiPort,
  ReservationReady,
} from "../../../features/reservations/public";
import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";

export type ReservationCreateValidationCode =
  | "INVALID_ACCOMMODATION"
  | "INVALID_DATE"
  | "INVALID_DATE_RANGE"
  | "INVALID_AVAILABILITY"
  | "OUTSIDE_BOOKING_WINDOW"
  | "UNAVAILABLE_DATE"
  | "INVALID_OCCUPANCY"
  | "INVALID_COUPON";

interface ReservationCreateValidationFailure extends Error {
  readonly code: ReservationCreateValidationCode;
}

export interface ReservationStartIntent {
  readonly type: "reservation.start";
  readonly accommodationId: number;
  readonly checkIn: string;
  readonly checkOut: string;
  readonly adultCount: number;
  readonly childCount: number;
  readonly infantCount: number;
  readonly petCount: number;
  readonly couponId: number | null;
}

interface ReservationCreateAccommodationSnapshot {
  readonly id: number;
  readonly maxOccupancy: number;
  readonly maxInfants: number;
  readonly maxPets: number;
  readonly availability: {
    readonly accommodationId: number;
    readonly bookingWindowStartInclusive: string;
    readonly bookingWindowEndExclusive: string;
    readonly unavailableRanges: readonly {
      readonly startDate: string;
      readonly endDateExclusive: string;
    }[];
  };
}

export interface AppliedReservationCoupon {
  readonly id: number;
  readonly name: string;
  readonly discount: number;
}

export interface ReservationCreateRouteLease {
  isCurrent(): boolean;
}

export interface ReservationCreateCommandInput {
  readonly intent: ReservationStartIntent;
  readonly accommodation: ReservationCreateAccommodationSnapshot;
  readonly appliedCoupon: AppliedReservationCoupon | null;
  readonly routeLease: ReservationCreateRouteLease;
}

export interface ValidatedReservationCreateCommand {
  readonly intent: ReservationStartIntent;
  readonly appliedCoupon: AppliedReservationCoupon | null;
  readonly routeLease: ReservationCreateRouteLease;
}

export interface ReservationCreateSessionPort {
  captureAuthenticatedSession(): AuthenticatedSessionScope | null;
  isCurrentSession(scope: AuthenticatedSessionScope): boolean;
}

interface ReservationCheckoutHandoffInput {
  readonly session: AuthenticatedSessionScope;
  readonly reservation: ReservationReady;
  readonly intent: ReservationStartIntent;
  readonly appliedCoupon: AppliedReservationCoupon | null;
}

interface ReservationCheckoutHandoffPreflightInput {
  readonly session: AuthenticatedSessionScope;
  readonly intent: ReservationStartIntent;
}

export type ReservationCheckoutHandoffPreflightResult =
  | { readonly status: "ready" }
  | { readonly status: "payment-recovery-required" }
  | { readonly status: "blocked" };

/**
 * This is intentionally synchronous. The current-route and session checks and
 * the versioned storage/navigation handoff therefore form one JavaScript turn.
 */
export interface ReservationCheckoutHandoffPort {
  preflight(
    input: ReservationCheckoutHandoffPreflightInput,
  ): ReservationCheckoutHandoffPreflightResult;
  /**
   * Rechecks the opaque v2 namespace in the same JavaScript turn that starts
   * the legacy transport. Unlike preflight, this guard has no navigation side
   * effects and can only allow or block the retired writer.
   */
  assertNoNewerRecovery(
    input: ReservationCheckoutHandoffPreflightInput,
  ): Extract<
    ReservationCheckoutHandoffPreflightResult,
    { readonly status: "ready" | "blocked" }
  >;
  commit(input: ReservationCheckoutHandoffInput): void;
}

export type ReservationCreateTransport = ReservationCreateApiPort;

export interface ReservationCreateWorkflowDependencies {
  readonly transport: ReservationCreateTransport;
  readonly session: ReservationCreateSessionPort;
  readonly handoff: ReservationCheckoutHandoffPort;
}

export type ReservationCreateTerminal =
  "handed-off" | "ambiguous" | "stale" | "disposed";

export type ReservationCreateResult =
  | {
      readonly status: "invalid";
      readonly error: ReservationCreateValidationFailure;
    }
  | {
      readonly status: "auth-required";
      readonly intent: ReservationStartIntent;
    }
  | {
      readonly status: "handed-off";
      readonly reservation: ReservationReady;
    }
  | { readonly status: "stale" }
  | { readonly status: "payment-recovery-required" }
  | { readonly status: "checkout-blocked" }
  | { readonly status: "definitive-failure"; readonly error: unknown }
  | { readonly status: "ambiguous"; readonly error: unknown }
  | { readonly status: "locked"; readonly terminal: ReservationCreateTerminal };

export interface ReservationCreateWorkflow {
  start(input: ReservationCreateCommandInput): Promise<ReservationCreateResult>;
  dispose(): void;
}
