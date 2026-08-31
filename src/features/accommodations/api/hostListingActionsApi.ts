import { requestApiDataNullable } from "../../../platform/http/request";
import { createHostListingActionsApi } from "./hostListingActionsApiFactory";

export const hostListingActionsApi = createHostListingActionsApi(
  requestApiDataNullable,
);
