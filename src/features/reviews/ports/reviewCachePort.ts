import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";

export interface ReviewCreatedCacheInput {
  readonly accommodationId: number;
  readonly scope: AuthenticatedSessionScope;
}

export interface ReviewCachePort {
  reviewCreated(input: ReviewCreatedCacheInput): Promise<void>;
}
