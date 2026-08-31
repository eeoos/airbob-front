import {
  requestApiData,
  requestApiDataNullable,
} from "../../../../platform/http/request";
import {
  createListingEditorApi,
  type ListingEditorApiTransport,
} from "./listingEditorApiFactory";

const platformListingEditorApiTransport: ListingEditorApiTransport = {
  request: requestApiData,
  requestNullable: requestApiDataNullable,
};

export const listingEditorApi = createListingEditorApi(
  platformListingEditorApiTransport,
);
