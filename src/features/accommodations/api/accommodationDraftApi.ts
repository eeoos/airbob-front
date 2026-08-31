import { requestApiData } from "../../../platform/http/request";
import { createAccommodationDraftApi } from "./accommodationDraftApiFactory";

export const accommodationDraftApi =
  createAccommodationDraftApi(requestApiData);
