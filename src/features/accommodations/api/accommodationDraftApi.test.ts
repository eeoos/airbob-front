import type { ApiDataRequest } from "../../../platform/http/request";
import {
  createAccommodationDraftApi,
  type AccommodationDraftApiTransport,
} from "./accommodationDraftApi";

describe("accommodation draft API", () => {
  it("posts an empty draft command and returns the envelope data id", async () => {
    const draft = { id: 88 };
    const request = vi.fn().mockResolvedValue(draft);
    const api = createAccommodationDraftApi(
      request as AccommodationDraftApiTransport,
    );

    await expect(api.create()).resolves.toBe(draft);
    expect(request).toHaveBeenCalledWith({
      method: "POST",
      path: "/accommodations",
    } satisfies ApiDataRequest);
    expect(request.mock.calls.at(0)?.at(0)).not.toHaveProperty("body");
    expect(request.mock.calls.at(0)?.at(0)).not.toHaveProperty("params");
  });
});
