import { requestApiData } from "../../../../platform/http/request";
import { createAccommodationDetailApi } from "./accommodationDetailApiFactory";

export const accommodationDetailApi =
  createAccommodationDetailApi(requestApiData);
