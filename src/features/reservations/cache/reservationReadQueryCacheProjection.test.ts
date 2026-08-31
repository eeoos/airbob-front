import { QueryClient } from "@tanstack/react-query";
import type { SessionSubject } from "../../../platform/session/sessionScope";
import { createReservationReadQueryCacheProjection } from "./reservationReadQueryCacheProjection";
import { reservationReadQueryKeys } from "../queries/reservationReadQueryKeys";

describe("reservation read cache projection", () => {
  it("invalidates only current-scope guest lists and the changed detail", async () => {
    const client = new QueryClient();
    const scope = {
      subject: "subject:member-1" as SessionSubject,
      epoch: 4,
    };
    const otherScope = { ...scope, epoch: 5 };
    const guestList = reservationReadQueryKeys.list(scope, "guest", {
      filterType: "UPCOMING",
      size: 20,
    });
    const guestDetail = reservationReadQueryKeys.detail(
      scope,
      "guest",
      "reservation-1",
    );
    const otherGuestDetail = reservationReadQueryKeys.detail(
      scope,
      "guest",
      "reservation-2",
    );
    const hostList = reservationReadQueryKeys.list(scope, "host", {
      filterType: "UPCOMING",
      size: 20,
    });
    const oldSessionList = reservationReadQueryKeys.list(
      otherScope,
      "guest",
      { filterType: "UPCOMING", size: 20 },
    );

    for (const [key, queryScope] of [
      [guestList, scope],
      [guestDetail, scope],
      [otherGuestDetail, scope],
      [hostList, scope],
      [oldSessionList, otherScope],
    ] as const) {
      client.setQueryDefaults(key, {
        meta: { session: queryScope },
      });
      client.setQueryData(key, { value: key.join(":") });
    }

    await createReservationReadQueryCacheProjection(
      client,
    ).guestReservationChanged({
      reservationUid: "reservation-1",
      scope,
    });

    expect(client.getQueryState(guestList)?.isInvalidated).toBe(true);
    expect(client.getQueryState(guestDetail)?.isInvalidated).toBe(true);
    expect(client.getQueryState(otherGuestDetail)?.isInvalidated).toBe(false);
    expect(client.getQueryState(hostList)?.isInvalidated).toBe(false);
    expect(client.getQueryState(oldSessionList)?.isInvalidated).toBe(false);
  });
});
