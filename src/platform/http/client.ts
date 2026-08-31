import { getApiBaseUrl } from "../config/publicRuntimeConfig";
import { createBrowserHttpClient } from "./clientCore";

export type { HttpClientRequest, HttpClientResponse } from "./clientCore";

export const httpClient = createBrowserHttpClient({
  baseUrl: getApiBaseUrl(),
  createRequest: () => new XMLHttpRequest(),
  fetchRequest: (...arguments_) => globalThis.fetch(...arguments_),
});
