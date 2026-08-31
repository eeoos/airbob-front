import type { AuthenticatedSessionScope } from "../../../platform/session/sessionScope";

interface ReviewCreatedCacheInput {
  readonly accommodationId: number;
  readonly scope: AuthenticatedSessionScope;
}

export interface ReviewCachePort {
  reviewCreated(input: ReviewCreatedCacheInput): Promise<void>;
}
