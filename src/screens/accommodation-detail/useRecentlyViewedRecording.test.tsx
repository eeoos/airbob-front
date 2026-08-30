import { act, renderHook, waitFor } from "@testing-library/react";
import type { SessionSubject } from "../../platform/session/sessionScope";
import { useRecentlyViewedRecording } from "./useRecentlyViewedRecording";

const scope = {
  subject: "subject:member_1" as SessionSubject,
  epoch: 2,
};

describe("useRecentlyViewedRecording", () => {
  it("keeps one in-flight success across a date-only route replacement", async () => {
    let resolveRecord!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveRecord = resolve;
    });
    const record = jest.fn().mockReturnValue(pending);
    const { rerender } = renderHook(
      ({ canRecord }) =>
        useRecentlyViewedRecording({
          accommodationId: 7,
          canRecord,
          record,
          scope,
        }),
      { initialProps: { canRecord: true } },
    );

    await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    const signal = record.mock.calls[0][1].signal as AbortSignal;
    rerender({ canRecord: true });

    expect(signal.aborted).toBe(false);
    expect(record).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRecord();
      await pending;
    });
    rerender({ canRecord: true });
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("records the key only after success so a later eligible lifecycle can retry", async () => {
    const record = jest
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);
    const { rerender } = renderHook(
      ({ canRecord }) =>
        useRecentlyViewedRecording({
          accommodationId: 7,
          canRecord,
          record,
          scope,
        }),
      { initialProps: { canRecord: true } },
    );

    await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    rerender({ canRecord: false });
    rerender({ canRecord: true });
    await waitFor(() => expect(record).toHaveBeenCalledTimes(2));
  });
});
