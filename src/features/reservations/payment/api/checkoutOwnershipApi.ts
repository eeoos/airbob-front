import {
  requestApiData,
  type ApiDataRequest,
} from "../../../../platform/http/request";
import type { CheckoutOwnershipApiPort } from "../ports/checkoutOwnershipApiPort";
import { encodeOpaquePathSegment } from "../../../../platform/http/opaquePathSegment";
import type { CheckoutOwnershipWire } from "./contracts";
import { toCheckoutOwnership } from "./mappers";

export type CheckoutOwnershipApiTransport = <T>(
  request: ApiDataRequest,
) => Promise<NonNullable<T>>;

export const createCheckoutOwnershipApi = (
  request: CheckoutOwnershipApiTransport,
): CheckoutOwnershipApiPort => ({
  async getCheckoutOwnership(reservationUid, options) {
    const reservationUidPathSegment = encodeOpaquePathSegment(reservationUid);
    const wire = await request<CheckoutOwnershipWire>({
      method: "GET",
      path: `/profile/guest/reservations/${reservationUidPathSegment}`,
      signal: options?.signal,
    });

    return toCheckoutOwnership(wire, reservationUid);
  },
});

export const checkoutOwnershipApi =
  createCheckoutOwnershipApi(requestApiData);
