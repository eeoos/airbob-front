import type { SessionQueryScope } from "../../../platform/query/sessionScope";
import type { SessionSubject } from "../../../platform/session/sessionScope";
import { searchReadQueryKeys } from "./queryKeys";

const anonymousScope: SessionQueryScope = { subject: null, epoch: 2 };
const memberScope: SessionQueryScope = {
  subject: "subject:member_7" as SessionSubject,
  epoch: 3,
};

describe("session-scoped search read query keys", () => {
  it("uses only the normalized request actually sent to the endpoint", () => {
    expect(
      searchReadQueryKeys.results(anonymousScope, {
        page: 0,
        destination: undefined,
        childOccupancy: 0,
        size: 18,
      }),
    ).toEqual([
      "search",
      "results",
      { childOccupancy: 0, page: 0, size: 18 },
      { session: { subject: null, epoch: 2 } },
    ]);

    expect(
      searchReadQueryKeys.results(anonymousScope, {
        childOccupancy: 0,
        page: 0,
        size: 18,
      }),
    ).toEqual(
      searchReadQueryKeys.results(anonymousScope, {
        size: 18,
        page: 0,
        childOccupancy: 0,
      }),
    );
  });

  it("fences the same public request by subject and epoch", () => {
    const request = { destination: "Seoul", page: 2, size: 18 };

    expect(searchReadQueryKeys.results(anonymousScope, request)).not.toEqual(
      searchReadQueryKeys.results(memberScope, request),
    );
    expect(searchReadQueryKeys.results(memberScope, request)).not.toEqual(
      searchReadQueryKeys.results({ ...memberScope, epoch: 4 }, request),
    );
  });
});
