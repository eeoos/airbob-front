import { isOpaqueIdentifier } from "../../shared/lib/opaqueIdentifier";
import { AppError } from "./errors";

export const encodeOpaquePathSegment = (value: string): string => {
  if (!isOpaqueIdentifier(value)) {
    throw new AppError({
      kind: "validation",
      code: "INVALID_OPAQUE_PATH_SEGMENT",
      message: "The API path identifier is invalid.",
    });
  }

  return encodeURIComponent(value);
};
