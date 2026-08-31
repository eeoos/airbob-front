export type HostListingAction = "delete" | "publish" | "unpublish";

interface HostListingActionRequestOptions {
  readonly signal?: AbortSignal;
}

export interface HostListingActionsApiPort {
  delete(
    accommodationId: number,
    options?: HostListingActionRequestOptions,
  ): Promise<void>;
  publish(
    accommodationId: number,
    options?: HostListingActionRequestOptions,
  ): Promise<void>;
  unpublish(
    accommodationId: number,
    options?: HostListingActionRequestOptions,
  ): Promise<void>;
}
