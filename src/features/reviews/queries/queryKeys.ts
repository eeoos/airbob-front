import {
  createSessionQueryMeta,
  type SessionQueryScope,
} from "../../../platform/query/sessionScope";

const root = ["reviews"] as const;

export const reviewReadQueryKeys = {
  root,
  accommodationRoot: (accommodationId: number | null) =>
    [...root, "accommodation", accommodationId] as const,
  accommodation: (
    scope: SessionQueryScope,
    accommodationId: number | null,
    sortType: "LATEST",
    size: number,
  ) =>
    Object.freeze([
      ...reviewReadQueryKeys.accommodationRoot(accommodationId),
      sortType,
      size,
      createSessionQueryMeta(scope),
    ] as const),
};
