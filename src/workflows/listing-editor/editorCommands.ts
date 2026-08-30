import type {
  ListingEditorAccommodation,
  ListingEditorApiPort,
  ListingEditorImage,
  ListingEditorUpdateInput,
} from "../../features/accommodations/listing-editor/ports/listingEditorApiPort";
import {
  LISTING_EDITOR_RESOURCE_MISMATCH_CODE,
  type ListingEditorQueryProjection,
  type ListingEditorQueryPort,
} from "../../features/accommodations/listing-editor/ports/listingEditorQueryPort";
import { AppError, isAppError } from "../../platform/http/errors";
import type { AuthenticatedSessionScope } from "../../platform/session/sessionScope";
import {
  createEditorOperation,
  createInitialEditorMachineState,
  editorMachineReducer,
  isEditorProcessingState,
  type EditorMachineEvent,
  type EditorMachineState,
  type EditorOperationContext,
  type EditorOperationJournal,
  type EditorOperationPhase,
  type EditorPersistenceIntent,
} from "./editorMachine";

export interface ListingEditorRouteLease {
  isCurrent(): boolean;
}

export interface ListingEditorSessionPort {
  captureAuthenticatedSession(): AuthenticatedSessionScope | null;
  isCurrentSession(scope: AuthenticatedSessionScope): boolean;
}

export type ListingEditorPublicationOutcome = "saved" | "published";

export interface ListingEditorPublicationInput {
  readonly accommodationId: number;
  readonly outcome: ListingEditorPublicationOutcome;
  readonly scope: AuthenticatedSessionScope;
}

export interface ListingEditorPublicationPort {
  publishEditorChanged(input: ListingEditorPublicationInput): Promise<void>;
}

export interface ListingEditorContinuationInput {
  readonly accommodationId: number;
  readonly intent: EditorPersistenceIntent;
  readonly scope: AuthenticatedSessionScope;
}

export interface ListingEditorContinuationPort {
  complete(input: ListingEditorContinuationInput): void | Promise<void>;
}

export interface ListingEditorWorkflowDependencies {
  readonly accommodationId: number;
  readonly api: ListingEditorApiPort;
  readonly continuation: ListingEditorContinuationPort;
  readonly instanceId: string;
  readonly publication: ListingEditorPublicationPort;
  readonly query: ListingEditorQueryPort;
  readonly routeLease: ListingEditorRouteLease;
  readonly session: ListingEditorSessionPort;
}

export interface ListingEditorDeleteCommand {
  readonly imageId: number;
  readonly originalIndex: number;
}

export interface ListingEditorPersistenceCommand {
  readonly intent: EditorPersistenceIntent;
  readonly pendingFiles: readonly File[];
  readonly update: ListingEditorUpdateInput;
  readonly onUploadProgress?: (progress: number) => void;
}

interface ListingEditorResultSnapshot {
  readonly accommodation: ListingEditorAccommodation;
  readonly baselineRevision: number;
}

export type ListingEditorCommandResult =
  | ({ readonly status: "ready" } & ListingEditorResultSnapshot)
  | {
      readonly status: "invalid-resource";
      readonly error: unknown;
    }
  | { readonly status: "denied"; readonly error: unknown }
  | {
      readonly status: "retryable-load-error";
      readonly error: unknown;
    }
  | ({
      readonly status: "delete-confirmed";
      readonly imageId: number;
      readonly originalIndex: number;
    } & ListingEditorResultSnapshot)
  | ({
      readonly status: "delete-rejected";
      readonly error: unknown;
      readonly imageId: number;
      readonly originalIndex: number;
    } & ListingEditorResultSnapshot)
  | ({
      readonly status: "completed";
      readonly intent: EditorPersistenceIntent;
      readonly journal: EditorOperationJournal;
      readonly uploadedImages: readonly ListingEditorImage[];
    } & ListingEditorResultSnapshot)
  | ({
      readonly status: "recoverable-error";
      readonly error: unknown;
      readonly phase: EditorOperationPhase;
      readonly journal: EditorOperationJournal;
      readonly uploadedImages: readonly ListingEditorImage[];
    } & ListingEditorResultSnapshot)
  | ({
      readonly status: "ambiguous";
      readonly error: unknown;
      readonly phase: EditorOperationPhase;
      readonly journal: EditorOperationJournal;
      readonly uploadedImages: readonly ListingEditorImage[];
    } & ListingEditorResultSnapshot)
  | { readonly status: "not-ready" }
  | { readonly status: "stale" };

export interface ListingEditorWorkflow {
  acknowledgeError(): boolean;
  canAcknowledgeError(): boolean;
  deleteImage(
    command: ListingEditorDeleteCommand,
  ): Promise<ListingEditorCommandResult>;
  dispose(): void;
  execute(
    command: ListingEditorPersistenceCommand,
  ): Promise<ListingEditorCommandResult>;
  getState(): EditorMachineState<
    ListingEditorAccommodation,
    ListingEditorImage
  >;
  hydrate(): Promise<ListingEditorCommandResult>;
  retry(): Promise<ListingEditorCommandResult>;
  subscribe(
    listener: (
      state: EditorMachineState<
        ListingEditorAccommodation,
        ListingEditorImage
      >,
    ) => void,
  ): () => void;
}

type EditorState = EditorMachineState<
  ListingEditorAccommodation,
  ListingEditorImage
>;
type EditorOperation = EditorOperationContext<
  ListingEditorAccommodation,
  ListingEditorImage
>;

type RetryPlan =
  | {
      readonly kind: "delete";
      readonly command: ListingEditorDeleteCommand;
    }
  | {
      readonly kind: "reconcile-delete";
      readonly command: ListingEditorDeleteCommand;
      readonly deleteError: unknown;
    }
  | {
      readonly kind: "delete-publication";
      readonly command: ListingEditorDeleteCommand;
    }
  | {
      readonly kind: "persistence";
      readonly command: ListingEditorPersistenceCommand;
    };

const STALE_RESULT = Object.freeze({ status: "stale" as const });
const NOT_READY_RESULT = Object.freeze({ status: "not-ready" as const });

const safeCheck = (check: () => boolean): boolean => {
  try {
    return check();
  } catch {
    return false;
  }
};

const isAbsentError = (error: unknown): boolean =>
  isAppError(error) && (error.status === 404 || error.code === "I004");

const isDeniedError = (error: unknown): boolean =>
  isAppError(error) &&
  (error.kind === "authentication" || error.status === 403);

const isInvalidResourceError = (error: unknown): boolean =>
  isAppError(error) &&
  (isAbsentError(error) || error.kind === "empty-data");

const isMismatchedResourceError = (error: unknown): boolean =>
  isAppError(error) && error.code === LISTING_EDITOR_RESOURCE_MISMATCH_CODE;

const isDefinitiveMutationFailure = (error: unknown): boolean => {
  if (!isAppError(error)) return false;

  switch (error.kind) {
    case "authentication":
    case "validation":
    case "conflict":
    case "configuration":
      return true;
    case "http":
      return !error.retryable && (error.status ?? 0) < 500;
    default:
      return false;
  }
};

const cloneUpdate = (
  update: ListingEditorUpdateInput,
): ListingEditorUpdateInput => ({
  ...update,
  ...(update.address ? { address: { ...update.address } } : {}),
  ...(update.amenities
    ? { amenities: update.amenities.map((amenity) => ({ ...amenity })) }
    : {}),
  ...(update.occupancyPolicy
    ? { occupancyPolicy: { ...update.occupancyPolicy } }
    : {}),
});

const createPersistenceRetryCommand = (
  command: ListingEditorPersistenceCommand,
  uploaded: boolean,
): ListingEditorPersistenceCommand =>
  uploaded
    ? {
        intent: command.intent,
        pendingFiles: [],
        update: cloneUpdate(command.update),
      }
    : command;

const cloneAccommodation = (
  value: ListingEditorAccommodation,
): ListingEditorAccommodation => ({
  ...value,
  address: value.address ? { ...value.address } : null,
  amenities: value.amenities.map((amenity) => ({ ...amenity })),
  images: value.images.map((image) => ({ ...image })),
  occupancyPolicy: value.occupancyPolicy
    ? { ...value.occupancyPolicy }
    : null,
});

const applyUpdate = (
  baseline: ListingEditorAccommodation,
  update: ListingEditorUpdateInput,
): ListingEditorAccommodation => ({
  ...baseline,
  ...(update.name !== undefined ? { name: update.name } : {}),
  ...(update.description !== undefined
    ? { description: update.description }
    : {}),
  ...(update.basePrice !== undefined ? { basePrice: update.basePrice } : {}),
  ...(update.currency !== undefined ? { currency: update.currency } : {}),
  ...(update.type !== undefined ? { type: update.type } : {}),
  ...(update.checkInTime !== undefined
    ? { checkInTime: update.checkInTime }
    : {}),
  ...(update.checkOutTime !== undefined
    ? { checkOutTime: update.checkOutTime }
    : {}),
  ...(update.address !== undefined
    ? {
        address: {
          postalCode: update.address.postalCode,
          country: update.address.country,
          state: update.address.state ?? null,
          city: update.address.city,
          district: update.address.district ?? null,
          street: update.address.street,
          detail: update.address.detail ?? null,
        },
      }
    : {}),
  ...(update.amenities !== undefined
    ? { amenities: update.amenities.map((amenity) => ({ ...amenity })) }
    : {}),
  ...(update.occupancyPolicy !== undefined
    ? { occupancyPolicy: { ...update.occupancyPolicy } }
    : {}),
});

const appendUploadedImages = (
  baseline: ListingEditorAccommodation,
  uploadedImages: readonly ListingEditorImage[],
): ListingEditorAccommodation => {
  const uploadedIds = new Set(uploadedImages.map((image) => image.id));
  return {
    ...baseline,
    images: [
      ...baseline.images.filter((image) => !uploadedIds.has(image.id)),
      ...uploadedImages.map((image) => ({ ...image })),
    ],
  };
};

const withoutImage = (
  baseline: ListingEditorAccommodation,
  imageId: number,
): ListingEditorAccommodation => ({
  ...baseline,
  images: baseline.images.filter((image) => image.id !== imageId),
});

const withReconciledImages = (
  baseline: ListingEditorAccommodation,
  images: readonly ListingEditorImage[],
): ListingEditorAccommodation => ({
  ...cloneAccommodation(baseline),
  images: images.map((image) => ({ ...image })),
});

const hasUpdate = (update: ListingEditorUpdateInput): boolean =>
  Object.keys(update).length > 0;

const createInvalidResourceError = (
  code: string,
  message: string,
): AppError =>
  new AppError({
    code,
    kind: "invalid-response",
    message,
  });

export const createListingEditorWorkflow = ({
  accommodationId,
  api,
  continuation,
  instanceId,
  publication,
  query,
  routeLease,
  session,
}: ListingEditorWorkflowDependencies): ListingEditorWorkflow => {
  let operationSequence = 1;
  let state: EditorState = createInitialEditorMachineState<
    ListingEditorAccommodation,
    ListingEditorImage
  >(instanceId, accommodationId, operationSequence);
  let activePromise: Promise<ListingEditorCommandResult> | null = null;
  let activeController: AbortController | null = null;
  let terminalPromise: Promise<ListingEditorCommandResult> | null = null;
  let retryPlan: RetryPlan | null = null;
  let projectedBaselineRevision = -1;
  let ownerScope: AuthenticatedSessionScope | null = null;
  let disposed = false;
  const listeners = new Set<(state: EditorState) => void>();

  const dispatch = (
    event: EditorMachineEvent<
      ListingEditorAccommodation,
      ListingEditorImage
    >,
  ) => {
    const next = editorMachineReducer(state, event);
    if (next === state) return;
    state = next;
    listeners.forEach((listener) => listener(state));
  };

  const nextOperationId = () => {
    operationSequence += 1;
    return operationSequence;
  };

  const isCurrent = (scope: AuthenticatedSessionScope): boolean =>
    !disposed &&
    safeCheck(() => routeLease.isCurrent()) &&
    safeCheck(() => session.isCurrentSession(scope));

  const markStale = (operationId?: number) => {
    dispatch({
      type: "MARK_STALE",
      instanceId,
      ...(operationId === undefined ? {} : { operationId }),
    });
  };

  const currentOperation = (operationId: number): EditorOperation | null => {
    if (!isEditorProcessingState(state)) {
      return null;
    }

    return state.operation.operationId === operationId
      ? state.operation
      : null;
  };

  const currentSnapshot = (): ListingEditorResultSnapshot | null => {
    if (state.status === "ready" || state.status === "completed") {
      return {
        accommodation: state.baseline,
        baselineRevision: state.baselineRevision,
      };
    }
    if (
      isEditorProcessingState(state) ||
      state.status === "recoverable-error"
    ) {
      return {
        accommodation: state.operation.committedBaseline,
        baselineRevision: state.operation.baselineRevision,
      };
    }
    return null;
  };

  const projectMutation = (
    operation: EditorOperation,
    projectionRevision: number,
    projection: ListingEditorQueryProjection,
    scope: AuthenticatedSessionScope,
  ) => {
    if (projectionRevision <= projectedBaselineRevision) return;
    query.projectHostDetail({
      accommodationId,
      fallback: operation.committedBaseline,
      projection,
      scope,
    });
    projectedBaselineRevision = projectionRevision;
  };

  const operationFailure = (
    operationId: number,
    phase: EditorOperationPhase,
    error: unknown,
    retry: "allowed" | "locked",
  ) => {
    dispatch({
      type: "OPERATION_FAILED",
      error,
      instanceId,
      operationId,
      phase,
      retry,
    });
  };

  const toOperationFailureResult = (
    operation: EditorOperation,
    phase: EditorOperationPhase,
    error: unknown,
    status: "ambiguous" | "recoverable-error",
  ): ListingEditorCommandResult => ({
    accommodation: operation.committedBaseline,
    baselineRevision: operation.baselineRevision,
    error,
    journal: operation.journal,
    phase,
    status,
    uploadedImages: operation.uploadedImages,
  });

  const beginActive = (
    controller: AbortController,
    run: () => Promise<ListingEditorCommandResult>,
  ): Promise<ListingEditorCommandResult> => {
    let resolveActive!: (result: ListingEditorCommandResult) => void;
    let rejectActive!: (error: unknown) => void;
    const promise = new Promise<ListingEditorCommandResult>(
      (resolve, reject) => {
        resolveActive = resolve;
        rejectActive = reject;
      },
    );
    activeController = controller;
    activePromise = promise;

    void promise.then(
      (result) => {
        if (
          result.status === "ambiguous" ||
          result.status === "invalid-resource" ||
          result.status === "denied" ||
          result.status === "stale" ||
          (result.status === "completed" && result.intent !== "advance")
        ) {
          terminalPromise = promise;
        }
        if (activePromise === promise) activePromise = null;
        if (activeController === controller) activeController = null;
      },
      () => {
        if (activePromise === promise) activePromise = null;
        if (activeController === controller) activeController = null;
      },
    );

    try {
      void run().then(resolveActive, rejectActive);
    } catch (error) {
      rejectActive(error);
    }

    return promise;
  };

  const captureCommand = (): {
    readonly controller: AbortController;
    readonly scope: AuthenticatedSessionScope;
  } | null => {
    const scope = ownerScope ?? session.captureAuthenticatedSession();
    if (
      scope === null ||
      !safeCheck(() => routeLease.isCurrent()) ||
      !safeCheck(() => session.isCurrentSession(scope))
    ) {
      markStale();
      return null;
    }
    ownerScope = scope;
    return { controller: new AbortController(), scope };
  };

  const runHydration = async (
    operationId: number,
    scope: AuthenticatedSessionScope,
    controller: AbortController,
  ): Promise<ListingEditorCommandResult> => {
    if (!isCurrent(scope)) {
      markStale(operationId);
      return STALE_RESULT;
    }

    if (!Number.isSafeInteger(accommodationId) || accommodationId < 1) {
      const error = createInvalidResourceError(
        "INVALID_LISTING_EDITOR_RESOURCE",
        "The listing editor route does not identify a valid accommodation.",
      );
      dispatch({
        type: "HYDRATION_INVALID_RESOURCE",
        accommodationId,
        error,
        instanceId,
        operationId,
      });
      return { error, status: "invalid-resource" };
    }

    try {
      const detail = await query.getHostDetail(accommodationId, {
        scope,
        signal: controller.signal,
      });
      if (!isCurrent(scope)) {
        markStale(operationId);
        return STALE_RESULT;
      }
      if (detail.id !== accommodationId) {
        const error = createInvalidResourceError(
          "MISMATCHED_LISTING_EDITOR_RESOURCE",
          "The listing editor response does not match the route resource.",
        );
        dispatch({
          type: "HYDRATION_INVALID_RESOURCE",
          accommodationId,
          error,
          instanceId,
          operationId,
        });
        return { error, status: "invalid-resource" };
      }

      const baseline = cloneAccommodation(detail);
      dispatch({
        type: "HYDRATION_SUCCEEDED",
        accommodationId,
        baseline,
        instanceId,
        operationId,
      });
      projectedBaselineRevision = 0;
      retryPlan = null;
      return {
        accommodation: baseline,
        baselineRevision: 0,
        status: "ready",
      };
    } catch (error) {
      if (!isCurrent(scope)) {
        markStale(operationId);
        return STALE_RESULT;
      }

      const type = isDeniedError(error)
        ? "HYDRATION_DENIED"
        : isInvalidResourceError(error) || isMismatchedResourceError(error)
          ? "HYDRATION_INVALID_RESOURCE"
          : "HYDRATION_RETRYABLE_FAILURE";
      dispatch({
        type,
        accommodationId,
        error,
        instanceId,
        operationId,
      });
      if (type === "HYDRATION_RETRYABLE_FAILURE") {
        retryPlan = null;
        return { error, status: "retryable-load-error" };
      }
      return {
        error,
        status:
          type === "HYDRATION_DENIED" ? "denied" : "invalid-resource",
      };
    }
  };

  const runDeletePublication = async (
    operationId: number,
    command: ListingEditorDeleteCommand,
    scope: AuthenticatedSessionScope,
  ): Promise<ListingEditorCommandResult> => {
    if (!isCurrent(scope)) {
      markStale(operationId);
      return STALE_RESULT;
    }

    try {
      const operation = currentOperation(operationId);
      if (!operation) return STALE_RESULT;
      projectMutation(
        operation,
        operation.baselineRevision,
        {
          images: operation.committedBaseline.images,
          kind: "replace-images",
        },
        scope,
      );
      await publication.publishEditorChanged({
        accommodationId,
        outcome: "saved",
        scope,
      });
      if (!isCurrent(scope)) {
        markStale(operationId);
        return STALE_RESULT;
      }
      dispatch({
        type: "PUBLICATION_SUCCEEDED",
        instanceId,
        operationId,
        stage: "save",
      });
      dispatch({ type: "DELETE_COMPLETED", instanceId, operationId });
      retryPlan = null;
      const snapshot = currentSnapshot();
      return snapshot
        ? {
            ...snapshot,
            imageId: command.imageId,
            originalIndex: command.originalIndex,
            status: "delete-confirmed",
          }
        : STALE_RESULT;
    } catch (error) {
      if (!isCurrent(scope)) {
        markStale(operationId);
        return STALE_RESULT;
      }
      const operation = currentOperation(operationId);
      if (!operation) return STALE_RESULT;
      operationFailure(
        operationId,
        "publication",
        error,
        "allowed",
      );
      retryPlan = { command, kind: "delete-publication" };
      return toOperationFailureResult(
        operation,
        "publication",
        error,
        "recoverable-error",
      );
    }
  };

  const confirmDelete = (
    operationId: number,
    command: ListingEditorDeleteCommand,
    baseline: ListingEditorAccommodation,
    scope: AuthenticatedSessionScope,
  ): Promise<ListingEditorCommandResult> => {
    dispatch({
      type: "DELETE_CONFIRMED",
      baseline,
      instanceId,
      operationId,
    });
    return runDeletePublication(operationId, command, scope);
  };

  const rejectDelete = (
    operationId: number,
    command: ListingEditorDeleteCommand,
    error: unknown,
    phase: "delete" | "reconcile-delete",
  ): ListingEditorCommandResult => {
    const operation = currentOperation(operationId);
    if (!operation) return STALE_RESULT;
    operationFailure(operationId, phase, error, "allowed");
    retryPlan = { kind: "delete", command };
    return {
      accommodation: operation.committedBaseline,
      baselineRevision: operation.baselineRevision,
      error,
      imageId: command.imageId,
      originalIndex: command.originalIndex,
      status: "delete-rejected",
    };
  };

  const runDeleteReconciliation = async (
    operationId: number,
    command: ListingEditorDeleteCommand,
    deleteError: unknown,
    scope: AuthenticatedSessionScope,
    controller: AbortController,
  ): Promise<ListingEditorCommandResult> => {
    if (!isCurrent(scope)) {
      markStale(operationId);
      return STALE_RESULT;
    }
    try {
      const detail = await query.getHostDetail(accommodationId, {
        scope,
        signal: controller.signal,
      });
      if (!isCurrent(scope)) {
        markStale(operationId);
        return STALE_RESULT;
      }
      if (detail.id !== accommodationId) {
        const error = createInvalidResourceError(
          "MISMATCHED_LISTING_EDITOR_RECONCILIATION",
          "The delete reconciliation response does not match the route resource.",
        );
        dispatch({
          type: "OPERATION_INVALID_RESOURCE",
          error,
          instanceId,
          operationId,
        });
        retryPlan = null;
        return { error, status: "invalid-resource" };
      }

      if (detail.images.some((image) => image.id === command.imageId)) {
        return rejectDelete(
          operationId,
          command,
          deleteError,
          "reconcile-delete",
        );
      }
      const operation = currentOperation(operationId);
      return operation
        ? confirmDelete(
            operationId,
            command,
            withReconciledImages(operation.committedBaseline, detail.images),
            scope,
          )
        : STALE_RESULT;
    } catch (error) {
      if (!isCurrent(scope)) {
        markStale(operationId);
        return STALE_RESULT;
      }
      const operation = currentOperation(operationId);
      if (!operation) return STALE_RESULT;
      if (isDeniedError(error)) {
        dispatch({
          type: "OPERATION_DENIED",
          error,
          instanceId,
          operationId,
        });
        retryPlan = null;
        return { error, status: "denied" };
      }
      if (isInvalidResourceError(error) || isMismatchedResourceError(error)) {
        dispatch({
          type: "OPERATION_INVALID_RESOURCE",
          error,
          instanceId,
          operationId,
        });
        retryPlan = null;
        return { error, status: "invalid-resource" };
      }
      operationFailure(
        operationId,
        "reconcile-delete",
        error,
        "allowed",
      );
      retryPlan = {
        command,
        deleteError,
        kind: "reconcile-delete",
      };
      return toOperationFailureResult(
        operation,
        "reconcile-delete",
        error,
        "recoverable-error",
      );
    }
  };

  const runDelete = async (
    operationId: number,
    command: ListingEditorDeleteCommand,
    scope: AuthenticatedSessionScope,
    controller: AbortController,
  ): Promise<ListingEditorCommandResult> => {
    if (!isCurrent(scope)) {
      markStale(operationId);
      return STALE_RESULT;
    }
    try {
      await api.deleteImage(accommodationId, command.imageId, {
        signal: controller.signal,
      });
      if (!isCurrent(scope)) {
        markStale(operationId);
        return STALE_RESULT;
      }
      const operation = currentOperation(operationId);
      return operation
        ? confirmDelete(
            operationId,
            command,
            withoutImage(operation.committedBaseline, command.imageId),
            scope,
          )
        : STALE_RESULT;
    } catch (error) {
      if (!isCurrent(scope)) {
        markStale(operationId);
        return STALE_RESULT;
      }
      const operation = currentOperation(operationId);
      if (!operation) return STALE_RESULT;
      if (isAbsentError(error)) {
        return confirmDelete(
          operationId,
          command,
          withoutImage(operation.committedBaseline, command.imageId),
          scope,
        );
      }
      if (isDefinitiveMutationFailure(error)) {
        return rejectDelete(operationId, command, error, "delete");
      }

      dispatch({
        type: "DELETE_RECONCILIATION_STARTED",
        instanceId,
        operationId,
      });
      return runDeleteReconciliation(
        operationId,
        command,
        error,
        scope,
        controller,
      );
    }
  };

  const mutationFailure = (
    operationId: number,
    command: ListingEditorPersistenceCommand,
    phase: EditorOperationPhase,
    error: unknown,
  ): ListingEditorCommandResult => {
    const operation = currentOperation(operationId);
    if (!operation) return STALE_RESULT;
    const definitive = isDefinitiveMutationFailure(error);
    operationFailure(
      operationId,
      phase,
      error,
      definitive ? "allowed" : "locked",
    );
    if (definitive) {
      retryPlan = {
        command: createPersistenceRetryCommand(
          command,
          operation.journal.uploaded,
        ),
        kind: "persistence",
      };
    } else {
      retryPlan = null;
    }
    return toOperationFailureResult(
      operation,
      phase,
      error,
      definitive ? "recoverable-error" : "ambiguous",
    );
  };

  const localFailure = (
    operationId: number,
    command: ListingEditorPersistenceCommand,
    phase: "continuation" | "publication",
    error: unknown,
  ): ListingEditorCommandResult => {
    const operation = currentOperation(operationId);
    if (!operation) return STALE_RESULT;
    operationFailure(operationId, phase, error, "allowed");
    retryPlan = {
      command: createPersistenceRetryCommand(
        command,
        operation.journal.uploaded,
      ),
      kind: "persistence",
    };
    return toOperationFailureResult(
      operation,
      phase,
      error,
      "recoverable-error",
    );
  };

  const runPersistence = async (
    operationId: number,
    command: ListingEditorPersistenceCommand,
    scope: AuthenticatedSessionScope,
    controller: AbortController,
  ): Promise<ListingEditorCommandResult> => {
    const ensureCurrent = () => {
      if (isCurrent(scope)) return true;
      markStale(operationId);
      return false;
    };
    if (!ensureCurrent()) return STALE_RESULT;

    let operation = currentOperation(operationId);
    if (!operation) return STALE_RESULT;
    const hasFiles = command.pendingFiles.length > 0;
    const hasFormUpdate = hasUpdate(command.update);
    const hasPersistenceChanges =
      hasFiles ||
      hasFormUpdate ||
      operation.journal.uploaded ||
      operation.journal.saved;

    if (hasFiles && !operation.journal.uploaded) {
      dispatch({ type: "UPLOAD_STARTED", instanceId, operationId });
      try {
        const uploadedImages = await api.uploadImages(
          accommodationId,
          command.pendingFiles,
          {
            onProgress: (progress) => {
              if (isCurrent(scope)) command.onUploadProgress?.(progress);
            },
            signal: controller.signal,
          },
        );
        if (!ensureCurrent()) return STALE_RESULT;
        operation = currentOperation(operationId);
        if (!operation) return STALE_RESULT;
        if (uploadedImages.length !== command.pendingFiles.length) {
          return mutationFailure(
            operationId,
            command,
            "upload",
            new AppError({
              code: "LISTING_EDITOR_UPLOAD_COUNT_MISMATCH",
              kind: "invalid-response",
              message:
                "The uploaded image response does not match the submitted files.",
            }),
          );
        }
        dispatch({
          type: "UPLOAD_SUCCEEDED",
          baseline: appendUploadedImages(
            operation.committedBaseline,
            uploadedImages,
          ),
          images: uploadedImages,
          instanceId,
          operationId,
        });
      } catch (error) {
        if (!ensureCurrent()) return STALE_RESULT;
        return mutationFailure(operationId, command, "upload", error);
      }
    }

    operation = currentOperation(operationId);
    if (!operation) return STALE_RESULT;
    if (operation.journal.uploaded) {
      try {
        projectMutation(
          operation,
          operation.baselineRevision - (operation.journal.saved ? 1 : 0),
          {
            images: operation.uploadedImages,
            kind: "append-images",
          },
          scope,
        );
      } catch (error) {
        return localFailure(operationId, command, "publication", error);
      }
    }
    if (hasFormUpdate && !operation.journal.saved) {
      dispatch({ type: "SAVE_STARTED", instanceId, operationId });
      try {
        await api.update(accommodationId, command.update, {
          signal: controller.signal,
        });
        if (!ensureCurrent()) return STALE_RESULT;
        operation = currentOperation(operationId);
        if (!operation) return STALE_RESULT;
        dispatch({
          type: "SAVE_SUCCEEDED",
          baseline: applyUpdate(operation.committedBaseline, command.update),
          instanceId,
          operationId,
        });
      } catch (error) {
        if (!ensureCurrent()) return STALE_RESULT;
        return mutationFailure(operationId, command, "save", error);
      }
    }

    operation = currentOperation(operationId);
    if (!operation) return STALE_RESULT;
    if (operation.journal.saved) {
      try {
        projectMutation(
          operation,
          operation.baselineRevision,
          { kind: "apply-update", update: command.update },
          scope,
        );
      } catch (error) {
        return localFailure(operationId, command, "publication", error);
      }
    }
    if (hasPersistenceChanges && !operation.journal.savePublication) {
      try {
        await publication.publishEditorChanged({
          accommodationId,
          outcome: "saved",
          scope,
        });
        if (!ensureCurrent()) return STALE_RESULT;
        dispatch({
          type: "PUBLICATION_SUCCEEDED",
          instanceId,
          operationId,
          stage: "save",
        });
      } catch (error) {
        if (!ensureCurrent()) return STALE_RESULT;
        return localFailure(operationId, command, "publication", error);
      }
    }

    operation = currentOperation(operationId);
    if (!operation) return STALE_RESULT;
    if (command.intent === "publish" && !operation.journal.published) {
      dispatch({ type: "PUBLISH_STARTED", instanceId, operationId });
      try {
        await api.publish(accommodationId, { signal: controller.signal });
        if (!ensureCurrent()) return STALE_RESULT;
        dispatch({ type: "PUBLISH_SUCCEEDED", instanceId, operationId });
      } catch (error) {
        if (!ensureCurrent()) return STALE_RESULT;
        return mutationFailure(operationId, command, "publish", error);
      }
    }

    operation = currentOperation(operationId);
    if (!operation) return STALE_RESULT;
    if (command.intent === "publish" && !operation.journal.finalPublication) {
      try {
        await publication.publishEditorChanged({
          accommodationId,
          outcome: "published",
          scope,
        });
        if (!ensureCurrent()) return STALE_RESULT;
        dispatch({
          type: "PUBLICATION_SUCCEEDED",
          instanceId,
          operationId,
          stage: "publish",
        });
      } catch (error) {
        if (!ensureCurrent()) return STALE_RESULT;
        return localFailure(operationId, command, "publication", error);
      }
    }

    operation = currentOperation(operationId);
    if (!operation) return STALE_RESULT;
    if (!operation.journal.continued) {
      try {
        await continuation.complete({
          accommodationId,
          intent: command.intent,
          scope,
        });
        if (!ensureCurrent()) return STALE_RESULT;
        operation = currentOperation(operationId);
        if (!operation) return STALE_RESULT;
        const completedOperation: EditorOperation = {
          ...operation,
          journal: { ...operation.journal, continued: true },
        };
        dispatch({
          type: "CONTINUATION_SUCCEEDED",
          instanceId,
          operationId,
        });
        retryPlan = null;
        const snapshot = currentSnapshot();
        return snapshot
          ? {
              ...snapshot,
              intent: command.intent,
              journal: completedOperation.journal,
              status: "completed",
              uploadedImages: completedOperation.uploadedImages,
            }
          : STALE_RESULT;
      } catch (error) {
        if (!ensureCurrent()) return STALE_RESULT;
        return localFailure(operationId, command, "continuation", error);
      }
    }

    return STALE_RESULT;
  };

  const startHydration = (
    retry: boolean,
  ): Promise<ListingEditorCommandResult> => {
    const captured = captureCommand();
    if (!captured) return Promise.resolve(STALE_RESULT);
    const operationId = retry ? nextOperationId() : operationSequence;
    return beginActive(captured.controller, () => {
      if (retry) {
        dispatch({
          type: "HYDRATION_RETRY_STARTED",
          accommodationId,
          instanceId,
          operationId,
        });
      }
      return runHydration(
        operationId,
        captured.scope,
        captured.controller,
      );
    });
  };

  const canDismissRecoverableError = (): boolean => {
    if (
      activePromise ||
      state.status !== "recoverable-error" ||
      state.retry !== "allowed"
    ) {
      return false;
    }
    if (
      retryPlan?.kind === "reconcile-delete" ||
      retryPlan?.kind === "delete-publication"
    ) {
      return false;
    }

    const { journal } = state.operation;
    const hasCompletedServerWork =
      journal.deletionReconciled ||
      journal.uploaded ||
      journal.saved ||
      journal.published;
    return !(
      hasCompletedServerWork &&
      (state.phase === "publication" || state.phase === "continuation")
    );
  };

  const dismissRecoverableError = (): boolean => {
    if (!canDismissRecoverableError()) return false;
    dispatch({ type: "ERROR_DISMISSED", instanceId });
    if (state.status !== "ready") return false;
    retryPlan = null;
    return true;
  };

  const prepareReadyState = (): Extract<EditorState, { status: "ready" }> | null => {
    if (state.status === "recoverable-error" && state.retry === "allowed") {
      dismissRecoverableError();
    }
    return state.status === "ready" ? state : null;
  };

  const startDelete = (
    command: ListingEditorDeleteCommand,
  ): Promise<ListingEditorCommandResult> => {
    const ready = prepareReadyState();
    if (!ready) return Promise.resolve(NOT_READY_RESULT);
    if (
      !Number.isSafeInteger(command.imageId) ||
      command.imageId < 1 ||
      !Number.isSafeInteger(command.originalIndex) ||
      command.originalIndex < 0
    ) {
      return Promise.resolve(NOT_READY_RESULT);
    }
    const captured = captureCommand();
    if (!captured) return Promise.resolve(STALE_RESULT);
    const operationId = nextOperationId();
    return beginActive(captured.controller, () => {
      dispatch({
        type: "OPERATION_STARTED",
        accommodationId,
        instanceId,
        operation: createEditorOperation<
          ListingEditorAccommodation,
          ListingEditorImage
        >({
          baselineRevision: ready.baselineRevision,
          committedBaseline: ready.baseline,
          deletion: command,
          instanceId,
          intent: "delete-image",
          operationId,
        }),
      });
      return runDelete(
        operationId,
        command,
        captured.scope,
        captured.controller,
      );
    });
  };

  const startPersistence = (
    command: ListingEditorPersistenceCommand,
  ): Promise<ListingEditorCommandResult> => {
    const copiedCommand: ListingEditorPersistenceCommand = {
      ...command,
      pendingFiles: [...command.pendingFiles],
      update: cloneUpdate(command.update),
    };
    const captured = captureCommand();
    if (!captured) return Promise.resolve(STALE_RESULT);

    const pendingDeletePlan =
      state.status === "recoverable-error" &&
      state.retry === "allowed" &&
      retryPlan !== null &&
      (retryPlan.kind === "reconcile-delete" ||
        retryPlan.kind === "delete-publication")
        ? retryPlan
        : null;

    if (pendingDeletePlan) {
      const deletionOperationId = nextOperationId();
      return beginActive(captured.controller, async () => {
        dispatch({
          type: "OPERATION_RETRY_STARTED",
          instanceId,
          operationId: deletionOperationId,
          resumeStatus:
            pendingDeletePlan.kind === "reconcile-delete"
              ? "reconciling-delete"
              : "preparing",
        });
        const deletion =
          pendingDeletePlan.kind === "reconcile-delete"
            ? await runDeleteReconciliation(
                deletionOperationId,
                pendingDeletePlan.command,
                pendingDeletePlan.deleteError,
                captured.scope,
                captured.controller,
              )
            : await runDeletePublication(
                deletionOperationId,
                pendingDeletePlan.command,
                captured.scope,
              );
        if (deletion.status !== "delete-confirmed") {
          return deletion;
        }
        if (!isCurrent(captured.scope) || state.status !== "ready") {
          markStale();
          return STALE_RESULT;
        }

        const operationId = nextOperationId();
        const ready = state;
        dispatch({
          type: "OPERATION_STARTED",
          accommodationId,
          instanceId,
          operation: createEditorOperation<
            ListingEditorAccommodation,
            ListingEditorImage
          >({
            baselineRevision: ready.baselineRevision,
            committedBaseline: ready.baseline,
            instanceId,
            intent: copiedCommand.intent,
            operationId,
          }),
        });
        return runPersistence(
          operationId,
          copiedCommand,
          captured.scope,
          captured.controller,
        );
      });
    }

    const ready = prepareReadyState();
    if (!ready) return Promise.resolve(NOT_READY_RESULT);
    const operationId = nextOperationId();
    return beginActive(captured.controller, () => {
      dispatch({
        type: "OPERATION_STARTED",
        accommodationId,
        instanceId,
        operation: createEditorOperation<
          ListingEditorAccommodation,
          ListingEditorImage
        >({
          baselineRevision: ready.baselineRevision,
          committedBaseline: ready.baseline,
          instanceId,
          intent: copiedCommand.intent,
          operationId,
        }),
      });
      return runPersistence(
        operationId,
        copiedCommand,
        captured.scope,
        captured.controller,
      );
    });
  };

  return {
    acknowledgeError() {
      return dismissRecoverableError();
    },

    canAcknowledgeError() {
      return canDismissRecoverableError();
    },

    deleteImage(command) {
      if (activePromise) return activePromise;
      if (terminalPromise) return terminalPromise;
      return startDelete(command);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      activeController?.abort();
      markStale();
      terminalPromise = activePromise ?? Promise.resolve(STALE_RESULT);
    },

    execute(command) {
      if (activePromise) return activePromise;
      if (terminalPromise) return terminalPromise;
      return startPersistence(command);
    },

    getState: () => state,

    hydrate() {
      if (activePromise) return activePromise;
      if (terminalPromise) return terminalPromise;
      if (state.status === "ready") {
        return Promise.resolve({
          accommodation: state.baseline,
          baselineRevision: state.baselineRevision,
          status: "ready",
        });
      }
      if (state.status === "retryable-load-error") {
        return startHydration(true);
      }
      if (state.status !== "hydrating") {
        return Promise.resolve(NOT_READY_RESULT);
      }
      return startHydration(false);
    },

    retry() {
      if (activePromise) return activePromise;
      if (terminalPromise) return terminalPromise;
      if (state.status === "retryable-load-error") {
        return startHydration(true);
      }
      if (
        state.status !== "recoverable-error" ||
        state.retry !== "allowed" ||
        retryPlan === null
      ) {
        return Promise.resolve(NOT_READY_RESULT);
      }

      const captured = captureCommand();
      if (!captured) return Promise.resolve(STALE_RESULT);
      const operationId = nextOperationId();
      const plan = retryPlan;
      const resumeOperation = (
        resumeStatus:
          | "deleting-image"
          | "preparing"
          | "reconciling-delete",
      ) => {
        dispatch({
          type: "OPERATION_RETRY_STARTED",
          instanceId,
          operationId,
          resumeStatus,
        });
      };

      if (plan.kind === "delete") {
        return beginActive(captured.controller, () => {
          resumeOperation("deleting-image");
          return runDelete(
            operationId,
            plan.command,
            captured.scope,
            captured.controller,
          );
        });
      }
      if (plan.kind === "reconcile-delete") {
        return beginActive(captured.controller, () => {
          resumeOperation("reconciling-delete");
          return runDeleteReconciliation(
            operationId,
            plan.command,
            plan.deleteError,
            captured.scope,
            captured.controller,
          );
        });
      }
      if (plan.kind === "delete-publication") {
        return beginActive(captured.controller, () => {
          resumeOperation("preparing");
          return runDeletePublication(
            operationId,
            plan.command,
            captured.scope,
          );
        });
      }
      if (plan.kind === "persistence") {
        return beginActive(captured.controller, () => {
          resumeOperation("preparing");
          return runPersistence(
            operationId,
            plan.command,
            captured.scope,
            captured.controller,
          );
        });
      }
      return Promise.resolve(NOT_READY_RESULT);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
