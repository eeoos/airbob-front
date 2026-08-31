import type { AuthenticatedSessionScope } from "../../../../platform/session/sessionScope";
import type {
  ListingEditorAccommodation,
  ListingEditorImage,
  ListingEditorUpdateInput,
} from "../model/listingEditor";

export const LISTING_EDITOR_RESOURCE_MISMATCH_CODE =
  "MISMATCHED_LISTING_EDITOR_RESOURCE";

interface ListingEditorQueryRequestOptions {
  readonly scope: AuthenticatedSessionScope;
  readonly signal?: AbortSignal;
}

interface ListingEditorQuerySnapshotInput {
  readonly accommodation: ListingEditorAccommodation;
  readonly accommodationId: number;
  readonly scope: AuthenticatedSessionScope;
}

export type ListingEditorQueryProjection =
  | {
      readonly kind: "replace-images";
      readonly images: readonly ListingEditorImage[];
    }
  | {
      readonly kind: "append-images";
      readonly images: readonly ListingEditorImage[];
    }
  | {
      readonly kind: "apply-update";
      readonly update: ListingEditorUpdateInput;
    };

interface ListingEditorQueryProjectionInput {
  readonly accommodationId: number;
  readonly fallback: ListingEditorAccommodation;
  readonly projection: ListingEditorQueryProjection;
  readonly scope: AuthenticatedSessionScope;
}

export interface ListingEditorQueryPort {
  getHostDetail(
    accommodationId: number,
    options: ListingEditorQueryRequestOptions,
  ): Promise<ListingEditorAccommodation>;
  projectHostDetail(input: ListingEditorQueryProjectionInput): void;
  setHostDetail(input: ListingEditorQuerySnapshotInput): void;
}
