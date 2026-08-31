import { requestApiData } from "../../../../platform/http/request";
import { createAccommodationAvailabilityApi } from "./accommodationAvailabilityApiFactory";

export const accommodationAvailabilityApi =
  createAccommodationAvailabilityApi(requestApiData);
