import { requestApiData } from "../../../platform/http/request";
import type {
  ReservationDetailByAudience,
  ReservationListPage,
  ReservationReadAudience,
} from "../model/reservationRead";
import type {
  ReservationListRequest,
  ReservationReadApiPort,
  ReservationReadRequestOptions,
} from "../ports/reservationReadApiPort";
import { encodeOpaquePathSegment } from "../../../platform/http/opaquePathSegment";
import type {
  GuestReservationDetailWire,
  GuestReservationPageWire,
  HostReservationDetailWire,
  HostReservationPageWire,
} from "./reservationReadContracts";
import {
  toGuestReservationDetail,
  toGuestReservationPage,
  toHostReservationDetail,
  toHostReservationPage,
} from "./reservationReadMappers";

export type ReservationReadApiTransport = typeof requestApiData;

const listPath = (audience: ReservationReadAudience) =>
  `/profile/${audience}/reservations`;

const detailPath = (
  audience: ReservationReadAudience,
  reservationUid: string,
) => `${listPath(audience)}/${encodeOpaquePathSegment(reservationUid)}`;

const toListParams = ({
  cursor,
  filterType,
  size,
}: ReservationListRequest) => ({
  ...(cursor === undefined ? {} : { cursor }),
  ...(filterType === undefined ? {} : { filterType }),
  ...(size === undefined ? {} : { size }),
});

export const createReservationReadApi = (
  request: ReservationReadApiTransport,
): ReservationReadApiPort => {
  const getList = async <TAudience extends ReservationReadAudience>(
    audience: TAudience,
    params: ReservationListRequest,
    options?: ReservationReadRequestOptions,
  ): Promise<ReservationListPage<TAudience>> => {
    if (audience === "guest") {
      const wire = await request<GuestReservationPageWire>({
        method: "GET",
        path: listPath(audience),
        params: toListParams(params),
        signal: options?.signal,
      });
      return toGuestReservationPage(wire) as ReservationListPage<TAudience>;
    }

    const wire = await request<HostReservationPageWire>({
      method: "GET",
      path: listPath(audience),
      params: toListParams(params),
      signal: options?.signal,
    });
    return toHostReservationPage(wire) as ReservationListPage<TAudience>;
  };

  const getDetail = async <TAudience extends ReservationReadAudience>(
    audience: TAudience,
    reservationUid: string,
    options?: ReservationReadRequestOptions,
  ): Promise<ReservationDetailByAudience<TAudience>> => {
    if (audience === "guest") {
      const wire = await request<GuestReservationDetailWire>({
        method: "GET",
        path: detailPath(audience, reservationUid),
        signal: options?.signal,
      });
      return toGuestReservationDetail(
        wire,
      ) as ReservationDetailByAudience<TAudience>;
    }

    const wire = await request<HostReservationDetailWire>({
      method: "GET",
      path: detailPath(audience, reservationUid),
      signal: options?.signal,
    });
    return toHostReservationDetail(
      wire,
    ) as ReservationDetailByAudience<TAudience>;
  };

  return { getDetail, getList };
};

export const reservationReadApi = createReservationReadApi(requestApiData);
