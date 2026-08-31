import type {
  ReservationDetailByAudience,
  ReservationFilterType,
  ReservationListPage,
  ReservationReadAudience,
} from "../model/reservationRead";

export interface ReservationReadRequestOptions {
  readonly signal?: AbortSignal;
}

export interface ReservationListRequest {
  readonly size?: number;
  readonly cursor?: string;
  readonly filterType?: ReservationFilterType;
}

export interface ReservationReadApiPort {
  getList<TAudience extends ReservationReadAudience>(
    audience: TAudience,
    request: ReservationListRequest,
    options?: ReservationReadRequestOptions,
  ): Promise<ReservationListPage<TAudience>>;
  getDetail<TAudience extends ReservationReadAudience>(
    audience: TAudience,
    reservationUid: string,
    options?: ReservationReadRequestOptions,
  ): Promise<ReservationDetailByAudience<TAudience>>;
}
