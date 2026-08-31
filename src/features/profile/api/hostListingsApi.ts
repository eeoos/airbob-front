import { requestApiData } from "../../../platform/http/request";
import { createHostListingsApi } from "./hostListingsApiFactory";

export const hostListingsApi = createHostListingsApi(requestApiData);
