import type { ApiDataRequest } from "../../../platform/http/request";
import {
  createHostListingActionsApi,
  type HostListingActionsApiTransport,
} from "./hostListingActionsApi";

describe("host listing actions API", () => {
  it("preserves publish, unpublish, and delete as nullable commands", async () => {
    const requestNullable = vi.fn().mockResolvedValue(null);
    const api = createHostListingActionsApi(
      requestNullable as HostListingActionsApiTransport,
    );

    await expect(api.publish(31)).resolves.toBeUndefined();
    await expect(api.unpublish(31)).resolves.toBeUndefined();
    await expect(api.delete(31)).resolves.toBeUndefined();

    expect(requestNullable).toHaveBeenNthCalledWith(1, {
      method: "PATCH",
      path: "/accommodations/31/publish",
    } satisfies ApiDataRequest);
    expect(requestNullable).toHaveBeenNthCalledWith(2, {
      method: "PATCH",
      path: "/accommodations/31/unpublish",
    } satisfies ApiDataRequest);
    expect(requestNullable).toHaveBeenNthCalledWith(3, {
      method: "DELETE",
      path: "/accommodations/31",
    } satisfies ApiDataRequest);
  });

  it("forwards workflow cancellation without changing method, path, or body", async () => {
    const requestNullable = vi.fn().mockResolvedValue(null);
    const api = createHostListingActionsApi(
      requestNullable as HostListingActionsApiTransport,
    );
    const signal = new AbortController().signal;

    await api.publish(31, { signal });

    expect(requestNullable).toHaveBeenCalledWith({
      method: "PATCH",
      path: "/accommodations/31/publish",
      signal,
    } satisfies ApiDataRequest);
    expect(requestNullable.mock.calls[0][0]).not.toHaveProperty("body");
  });
});
