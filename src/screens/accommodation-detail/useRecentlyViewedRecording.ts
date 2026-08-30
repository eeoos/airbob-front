import { useEffect, useRef } from "react";
import type { AccommodationDetailQueryOptions } from "../../features/accommodations/detail/public";

interface UseRecentlyViewedRecordingOptions {
  readonly accommodationId: number | null;
  readonly canRecord: boolean;
  readonly record: (
    accommodationId: number,
    options: { readonly signal: AbortSignal },
  ) => Promise<void>;
  readonly scope: AccommodationDetailQueryOptions["scope"];
}

export const useRecentlyViewedRecording = ({
  accommodationId,
  canRecord,
  record,
  scope,
}: UseRecentlyViewedRecordingOptions): void => {
  const activeRef = useRef<{
    readonly controller: AbortController;
    readonly key: string;
  } | null>(null);
  const recordedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (accommodationId === null || scope.subject === null || !canRecord) {
      return;
    }

    const key = `${scope.subject}:${scope.epoch}:${accommodationId}`;
    if (recordedKeyRef.current === key || activeRef.current?.key === key) {
      return;
    }

    const controller = new AbortController();
    activeRef.current = { controller, key };
    void record(accommodationId, { signal: controller.signal })
      .then(() => {
        if (!controller.signal.aborted) recordedKeyRef.current = key;
      })
      .catch(() => undefined)
      .finally(() => {
        if (activeRef.current?.controller === controller) {
          activeRef.current = null;
        }
      });

    return () => {
      if (activeRef.current?.controller === controller) {
        activeRef.current = null;
      }
      controller.abort();
    };
  }, [accommodationId, canRecord, record, scope.epoch, scope.subject]);
};
