import {
  createSessionQueryMeta,
  type SessionQueryScope,
} from "../../../../platform/query/sessionScope";

const root = ["accommodation", "listing-editor"] as const;

export const listingEditorQueryKeys = {
  root,
  detail: (scope: SessionQueryScope, accommodationId: number) =>
    [...root, accommodationId, createSessionQueryMeta(scope)] as const,
};
