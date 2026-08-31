export type EditorPersistenceIntent = "advance" | "save-exit" | "publish";
export type EditorOperationIntent = EditorPersistenceIntent | "delete-image";

export type EditorOperationPhase =
  | "delete"
  | "reconcile-delete"
  | "upload"
  | "save"
  | "publication"
  | "publish"
  | "continuation";

export type EditorOperationRetry = "allowed" | "locked";

export interface EditorDeletionContext {
  readonly imageId: number;
  readonly originalIndex: number;
}

export interface EditorOperationJournal {
  readonly deletionReconciled: boolean;
  readonly uploaded: boolean;
  readonly saved: boolean;
  readonly savePublication: boolean;
  readonly published: boolean;
  readonly finalPublication: boolean;
  readonly continued: boolean;
}

export interface EditorOperationContext<TBaseline = unknown, TImage = unknown> {
  readonly instanceId: string;
  readonly operationId: number;
  readonly intent: EditorOperationIntent;
  readonly deletion: EditorDeletionContext | null;
  readonly journal: EditorOperationJournal;
  readonly baselineRevision: number;
  readonly committedBaseline: TBaseline;
  readonly uploadedImages: readonly TImage[];
}

interface EditorStateIdentity {
  readonly instanceId: string;
  readonly accommodationId: number;
}

export interface EditorHydratingState extends EditorStateIdentity {
  readonly status: "hydrating";
  readonly operationId: number;
}

export interface EditorInvalidResourceState extends EditorStateIdentity {
  readonly status: "invalid-resource";
  readonly error: unknown;
}

export interface EditorDeniedState extends EditorStateIdentity {
  readonly status: "denied";
  readonly error: unknown;
}

export interface EditorRetryableLoadErrorState extends EditorStateIdentity {
  readonly status: "retryable-load-error";
  readonly error: unknown;
}

export interface EditorReadyState<
  TBaseline = unknown,
> extends EditorStateIdentity {
  readonly status: "ready";
  readonly baseline: TBaseline;
  readonly baselineRevision: number;
}

export type EditorProcessingStatus =
  | "deleting-image"
  | "reconciling-delete"
  | "preparing"
  | "uploading"
  | "saving"
  | "publishing";

export interface EditorProcessingState<
  TBaseline = unknown,
  TImage = unknown,
> extends EditorStateIdentity {
  readonly status: EditorProcessingStatus;
  readonly operation: EditorOperationContext<TBaseline, TImage>;
}

export interface EditorRecoverableErrorState<
  TBaseline = unknown,
  TImage = unknown,
> extends EditorStateIdentity {
  readonly status: "recoverable-error";
  readonly error: unknown;
  readonly phase: EditorOperationPhase;
  readonly retry: EditorOperationRetry;
  readonly operation: EditorOperationContext<TBaseline, TImage>;
}

export interface EditorCompletedState<
  TBaseline = unknown,
  TImage = unknown,
> extends EditorStateIdentity {
  readonly status: "completed";
  readonly baseline: TBaseline;
  readonly baselineRevision: number;
  readonly operation: EditorOperationContext<TBaseline, TImage>;
}

export interface EditorStaleState extends EditorStateIdentity {
  readonly status: "stale";
}

export type EditorMachineState<TBaseline = unknown, TImage = unknown> =
  | EditorHydratingState
  | EditorInvalidResourceState
  | EditorDeniedState
  | EditorRetryableLoadErrorState
  | EditorReadyState<TBaseline>
  | EditorProcessingState<TBaseline, TImage>
  | EditorRecoverableErrorState<TBaseline, TImage>
  | EditorCompletedState<TBaseline, TImage>
  | EditorStaleState;

interface EditorEventIdentity {
  readonly instanceId: string;
}

interface EditorHydrationEventIdentity extends EditorEventIdentity {
  readonly accommodationId: number;
  readonly operationId: number;
}

interface EditorOperationEventIdentity extends EditorEventIdentity {
  readonly operationId: number;
}

export type EditorMachineEvent<TBaseline = unknown, TImage = unknown> =
  | ({
      readonly type: "HYDRATION_RETRY_STARTED";
    } & EditorHydrationEventIdentity)
  | ({
      readonly type: "HYDRATION_SUCCEEDED";
      readonly baseline: TBaseline;
    } & EditorHydrationEventIdentity)
  | ({
      readonly type:
        | "HYDRATION_INVALID_RESOURCE"
        | "HYDRATION_DENIED"
        | "HYDRATION_RETRYABLE_FAILURE";
      readonly error: unknown;
    } & EditorHydrationEventIdentity)
  | ({
      readonly type: "OPERATION_STARTED";
      readonly accommodationId: number;
      readonly operation: EditorOperationContext<TBaseline, TImage>;
    } & EditorEventIdentity)
  | ({
      readonly type:
        | "DELETE_RECONCILIATION_STARTED"
        | "DELETE_COMPLETED"
        | "UPLOAD_STARTED"
        | "SAVE_STARTED"
        | "PUBLISH_STARTED";
    } & EditorOperationEventIdentity)
  | ({
      readonly type: "DELETE_CONFIRMED";
      readonly baseline: TBaseline;
    } & EditorOperationEventIdentity)
  | ({
      readonly type: "UPLOAD_SUCCEEDED";
      readonly baseline: TBaseline;
      readonly images: readonly TImage[];
    } & EditorOperationEventIdentity)
  | ({
      readonly type: "SAVE_SUCCEEDED";
      readonly baseline: TBaseline;
    } & EditorOperationEventIdentity)
  | ({
      readonly type: "PUBLICATION_SUCCEEDED";
      readonly stage: "save" | "publish";
    } & EditorOperationEventIdentity)
  | ({
      readonly type: "PUBLISH_SUCCEEDED";
    } & EditorOperationEventIdentity)
  | ({
      readonly type: "CONTINUATION_SUCCEEDED";
    } & EditorOperationEventIdentity)
  | ({
      readonly type: "OPERATION_FAILED";
      readonly error: unknown;
      readonly phase: EditorOperationPhase;
      readonly retry: EditorOperationRetry;
    } & EditorOperationEventIdentity)
  | ({
      readonly type: "OPERATION_INVALID_RESOURCE" | "OPERATION_DENIED";
      readonly error: unknown;
    } & EditorOperationEventIdentity)
  | ({
      readonly type: "OPERATION_RETRY_STARTED";
      readonly resumeStatus:
        "deleting-image" | "preparing" | "reconciling-delete";
    } & EditorOperationEventIdentity)
  | ({
      readonly type: "ERROR_DISMISSED";
    } & EditorEventIdentity)
  | ({
      readonly type: "MARK_STALE";
      readonly operationId?: number;
    } & EditorEventIdentity);

const EMPTY_JOURNAL: EditorOperationJournal = Object.freeze({
  deletionReconciled: false,
  uploaded: false,
  saved: false,
  savePublication: false,
  published: false,
  finalPublication: false,
  continued: false,
});

export interface CreateEditorOperationInput<
  TBaseline = unknown,
  TImage = unknown,
> {
  readonly committedBaseline: TBaseline;
  readonly baselineRevision?: number;
  readonly deletion?: EditorDeletionContext;
  readonly instanceId: string;
  readonly intent: EditorOperationIntent;
  readonly journal?: Partial<EditorOperationJournal>;
  readonly operationId: number;
  readonly uploadedImages?: readonly TImage[];
}

export const createEditorOperation = <TBaseline, TImage>({
  committedBaseline,
  baselineRevision = 0,
  deletion,
  instanceId,
  intent,
  journal,
  operationId,
  uploadedImages = [],
}: CreateEditorOperationInput<TBaseline, TImage>): EditorOperationContext<
  TBaseline,
  TImage
> => ({
  committedBaseline,
  baselineRevision,
  deletion: deletion ?? null,
  instanceId,
  intent,
  journal: { ...EMPTY_JOURNAL, ...journal },
  operationId,
  uploadedImages: [...uploadedImages],
});

export const createInitialEditorMachineState = <
  TBaseline = unknown,
  TImage = unknown,
>(
  instanceId: string,
  accommodationId: number,
  operationId: number,
): EditorMachineState<TBaseline, TImage> => ({
  accommodationId,
  instanceId,
  operationId,
  status: "hydrating",
});

export const isEditorProcessingState = <TBaseline, TImage>(
  state: EditorMachineState<TBaseline, TImage>,
): state is EditorProcessingState<TBaseline, TImage> =>
  state.status === "deleting-image" ||
  state.status === "reconciling-delete" ||
  state.status === "preparing" ||
  state.status === "uploading" ||
  state.status === "saving" ||
  state.status === "publishing";

const hasOperation = <TBaseline, TImage>(
  state: EditorMachineState<TBaseline, TImage>,
): state is
  | EditorProcessingState<TBaseline, TImage>
  | EditorRecoverableErrorState<TBaseline, TImage>
  | EditorCompletedState<TBaseline, TImage> =>
  isEditorProcessingState(state) ||
  state.status === "recoverable-error" ||
  state.status === "completed";

const isTerminalState = <TBaseline, TImage>(
  state: EditorMachineState<TBaseline, TImage>,
): boolean =>
  state.status === "invalid-resource" ||
  state.status === "denied" ||
  state.status === "completed" ||
  state.status === "stale";

const updateOperation = <TBaseline, TImage>(
  state: EditorProcessingState<TBaseline, TImage>,
  operation: EditorOperationContext<TBaseline, TImage>,
  status: EditorProcessingStatus = "preparing",
): EditorProcessingState<TBaseline, TImage> => ({
  ...state,
  operation,
  status,
});

const journalOperation = <TBaseline, TImage>(
  operation: EditorOperationContext<TBaseline, TImage>,
  journal: Partial<EditorOperationJournal>,
  patch: Partial<
    Pick<
      EditorOperationContext<TBaseline, TImage>,
      | "baselineRevision"
      | "committedBaseline"
      | "operationId"
      | "uploadedImages"
    >
  > = {},
): EditorOperationContext<TBaseline, TImage> => ({
  ...operation,
  ...patch,
  journal: { ...operation.journal, ...journal },
});

const matchesHydration = <TBaseline, TImage>(
  state: EditorMachineState<TBaseline, TImage>,
  event: EditorHydrationEventIdentity,
): state is EditorHydratingState =>
  state.status === "hydrating" &&
  state.instanceId === event.instanceId &&
  state.accommodationId === event.accommodationId &&
  state.operationId === event.operationId;

const matchesOperation = <TBaseline, TImage>(
  state: EditorMachineState<TBaseline, TImage>,
  event: EditorOperationEventIdentity,
): state is EditorProcessingState<TBaseline, TImage> =>
  isEditorProcessingState(state) &&
  state.instanceId === event.instanceId &&
  state.operation.operationId === event.operationId;

export const editorMachineReducer = <TBaseline, TImage>(
  state: EditorMachineState<TBaseline, TImage>,
  event: EditorMachineEvent<TBaseline, TImage>,
): EditorMachineState<TBaseline, TImage> => {
  if (state.instanceId !== event.instanceId) return state;

  if (event.type === "MARK_STALE") {
    if (isTerminalState(state)) return state;
    if (
      event.operationId !== undefined &&
      ((state.status === "hydrating" &&
        state.operationId !== event.operationId) ||
        (hasOperation(state) &&
          state.operation.operationId !== event.operationId))
    ) {
      return state;
    }

    return {
      accommodationId: state.accommodationId,
      instanceId: state.instanceId,
      status: "stale",
    };
  }

  if (isTerminalState(state)) return state;

  if (event.type === "HYDRATION_RETRY_STARTED") {
    if (
      state.status !== "retryable-load-error" ||
      state.accommodationId !== event.accommodationId
    ) {
      return state;
    }

    return {
      accommodationId: event.accommodationId,
      instanceId: state.instanceId,
      operationId: event.operationId,
      status: "hydrating",
    };
  }

  if (
    event.type === "HYDRATION_SUCCEEDED" ||
    event.type === "HYDRATION_INVALID_RESOURCE" ||
    event.type === "HYDRATION_DENIED" ||
    event.type === "HYDRATION_RETRYABLE_FAILURE"
  ) {
    if (!matchesHydration(state, event)) return state;

    if (event.type === "HYDRATION_SUCCEEDED") {
      return {
        accommodationId: state.accommodationId,
        baseline: event.baseline,
        baselineRevision: 0,
        instanceId: state.instanceId,
        status: "ready",
      };
    }

    const status =
      event.type === "HYDRATION_INVALID_RESOURCE"
        ? "invalid-resource"
        : event.type === "HYDRATION_DENIED"
          ? "denied"
          : "retryable-load-error";

    return {
      accommodationId: state.accommodationId,
      error: event.error,
      instanceId: state.instanceId,
      status,
    };
  }

  if (event.type === "OPERATION_STARTED") {
    if (
      state.status !== "ready" ||
      state.accommodationId !== event.accommodationId ||
      event.operation.instanceId !== state.instanceId ||
      event.operation.baselineRevision !== state.baselineRevision ||
      event.operation.committedBaseline !== state.baseline
    ) {
      return state;
    }

    if (
      event.operation.intent === "delete-image" &&
      event.operation.deletion === null
    ) {
      return state;
    }

    return {
      accommodationId: state.accommodationId,
      instanceId: state.instanceId,
      operation: event.operation,
      status:
        event.operation.intent === "delete-image"
          ? "deleting-image"
          : "preparing",
    };
  }

  if (event.type === "ERROR_DISMISSED") {
    if (
      state.status !== "recoverable-error" ||
      state.retry !== "allowed" ||
      (state.operation.intent === "delete-image" &&
        state.phase === "publication")
    ) {
      return state;
    }

    return {
      accommodationId: state.accommodationId,
      baseline: state.operation.committedBaseline,
      baselineRevision: state.operation.baselineRevision,
      instanceId: state.instanceId,
      status: "ready",
    };
  }

  if (event.type === "OPERATION_RETRY_STARTED") {
    if (state.status !== "recoverable-error" || state.retry !== "allowed") {
      return state;
    }

    return {
      accommodationId: state.accommodationId,
      instanceId: state.instanceId,
      operation: journalOperation(
        state.operation,
        {},
        { operationId: event.operationId },
      ),
      status: event.resumeStatus,
    };
  }

  if (!matchesOperation(state, event)) return state;

  switch (event.type) {
    case "OPERATION_INVALID_RESOURCE":
    case "OPERATION_DENIED":
      return {
        accommodationId: state.accommodationId,
        error: event.error,
        instanceId: state.instanceId,
        status:
          event.type === "OPERATION_DENIED" ? "denied" : "invalid-resource",
      };

    case "DELETE_RECONCILIATION_STARTED":
      return updateOperation(state, state.operation, "reconciling-delete");

    case "DELETE_CONFIRMED":
      return updateOperation(
        state,
        journalOperation(
          state.operation,
          { deletionReconciled: true },
          {
            baselineRevision: state.operation.baselineRevision + 1,
            committedBaseline: event.baseline,
          },
        ),
      );

    case "DELETE_COMPLETED":
      return {
        accommodationId: state.accommodationId,
        baseline: state.operation.committedBaseline,
        baselineRevision: state.operation.baselineRevision,
        instanceId: state.instanceId,
        status: "ready",
      };

    case "UPLOAD_STARTED":
      return updateOperation(state, state.operation, "uploading");

    case "UPLOAD_SUCCEEDED":
      return updateOperation(
        state,
        journalOperation(
          state.operation,
          { uploaded: true },
          {
            committedBaseline: event.baseline,
            baselineRevision: state.operation.baselineRevision + 1,
            uploadedImages: event.images,
          },
        ),
      );

    case "SAVE_STARTED":
      return updateOperation(state, state.operation, "saving");

    case "SAVE_SUCCEEDED":
      return updateOperation(
        state,
        journalOperation(
          state.operation,
          { saved: true },
          {
            baselineRevision: state.operation.baselineRevision + 1,
            committedBaseline: event.baseline,
          },
        ),
      );

    case "PUBLICATION_SUCCEEDED":
      return updateOperation(
        state,
        journalOperation(state.operation, {
          [event.stage === "save" ? "savePublication" : "finalPublication"]:
            true,
        }),
      );

    case "PUBLISH_STARTED":
      return updateOperation(state, state.operation, "publishing");

    case "PUBLISH_SUCCEEDED":
      return updateOperation(
        state,
        journalOperation(state.operation, { published: true }),
      );

    case "CONTINUATION_SUCCEEDED": {
      const operation = journalOperation(state.operation, { continued: true });
      if (operation.intent === "advance") {
        return {
          accommodationId: state.accommodationId,
          baseline: operation.committedBaseline,
          baselineRevision: operation.baselineRevision,
          instanceId: state.instanceId,
          status: "ready",
        };
      }

      return {
        accommodationId: state.accommodationId,
        baseline: operation.committedBaseline,
        baselineRevision: operation.baselineRevision,
        instanceId: state.instanceId,
        operation,
        status: "completed",
      };
    }

    case "OPERATION_FAILED":
      return {
        accommodationId: state.accommodationId,
        error: event.error,
        instanceId: state.instanceId,
        operation: state.operation,
        phase: event.phase,
        retry: event.retry,
        status: "recoverable-error",
      };
  }
};
