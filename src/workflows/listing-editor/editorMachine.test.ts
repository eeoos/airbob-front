import {
  createEditorOperation,
  createInitialEditorMachineState,
  editorMachineReducer,
  type EditorMachineEvent,
  type EditorMachineState,
} from "./editorMachine";

interface Baseline {
  readonly name: string;
}

interface Image {
  readonly id: number;
}

const reduce = (
  state: EditorMachineState<Baseline, Image>,
  event: EditorMachineEvent<Baseline, Image>,
) => editorMachineReducer(state, event);

const hydrated = (baseline: Baseline = { name: "server" }) =>
  reduce(createInitialEditorMachineState<Baseline, Image>("editor-a", 31, 1), {
    type: "HYDRATION_SUCCEEDED",
    accommodationId: 31,
    baseline,
    instanceId: "editor-a",
    operationId: 1,
  });

describe("editorMachineReducer", () => {
  it("hydrates only the matching instance, operation, and accommodation", () => {
    const initial = createInitialEditorMachineState<Baseline, Image>(
      "editor-a",
      31,
      1,
    );

    const staleEvents: EditorMachineEvent<Baseline, Image>[] = [
      {
        type: "HYDRATION_SUCCEEDED",
        accommodationId: 31,
        baseline: { name: "wrong instance" },
        instanceId: "editor-b",
        operationId: 1,
      },
      {
        type: "HYDRATION_SUCCEEDED",
        accommodationId: 31,
        baseline: { name: "wrong operation" },
        instanceId: "editor-a",
        operationId: 2,
      },
      {
        type: "HYDRATION_SUCCEEDED",
        accommodationId: 32,
        baseline: { name: "wrong accommodation" },
        instanceId: "editor-a",
        operationId: 1,
      },
    ];

    expect(staleEvents.reduce(reduce, initial)).toBe(initial);
    expect(
      reduce(initial, {
        type: "HYDRATION_SUCCEEDED",
        accommodationId: 31,
        baseline: { name: "matching" },
        instanceId: "editor-a",
        operationId: 1,
      }),
    ).toEqual({
      accommodationId: 31,
      baseline: { name: "matching" },
      baselineRevision: 0,
      instanceId: "editor-a",
      status: "ready",
    });
  });

  it.each([
    ["HYDRATION_INVALID_RESOURCE", "invalid-resource"],
    ["HYDRATION_DENIED", "denied"],
    ["HYDRATION_RETRYABLE_FAILURE", "retryable-load-error"],
  ] as const)("maps %s to the explicit %s state", (type, status) => {
    const initial = createInitialEditorMachineState<Baseline, Image>(
      "editor-a",
      31,
      1,
    );

    expect(
      reduce(initial, {
        type,
        accommodationId: 31,
        error: new Error(status),
        instanceId: "editor-a",
        operationId: 1,
      }),
    ).toMatchObject({ status });
  });

  it("accepts one operation from ready and ignores another start", () => {
    const baseline = { name: "server" };
    const ready = hydrated(baseline);
    const first = createEditorOperation<Baseline, Image>({
      committedBaseline: baseline,
      instanceId: "editor-a",
      intent: "publish",
      operationId: 2,
    });
    const second = createEditorOperation<Baseline, Image>({
      committedBaseline: baseline,
      instanceId: "editor-a",
      intent: "save-exit",
      operationId: 3,
    });
    const started = reduce(ready, {
      type: "OPERATION_STARTED",
      accommodationId: 31,
      instanceId: "editor-a",
      operation: first,
    });

    expect(started).toMatchObject({
      operation: first,
      status: "preparing",
    });
    expect(
      reduce(started, {
        type: "OPERATION_STARTED",
        accommodationId: 31,
        instanceId: "editor-a",
        operation: second,
      }),
    ).toBe(started);
  });

  it("journals successful upload, save, publication, and publish phases", () => {
    const baseline = { name: "server" };
    const operation = createEditorOperation<Baseline, Image>({
      committedBaseline: baseline,
      instanceId: "editor-a",
      intent: "publish",
      operationId: 2,
    });
    let state = reduce(hydrated(baseline), {
      type: "OPERATION_STARTED",
      accommodationId: 31,
      instanceId: "editor-a",
      operation,
    });

    state = reduce(state, {
      type: "UPLOAD_STARTED",
      instanceId: "editor-a",
      operationId: 2,
    });
    state = reduce(state, {
      type: "UPLOAD_SUCCEEDED",
      baseline: { name: "draft with image" },
      images: [{ id: 7 }],
      instanceId: "editor-a",
      operationId: 2,
    });
    state = reduce(state, {
      type: "SAVE_STARTED",
      instanceId: "editor-a",
      operationId: 2,
    });
    state = reduce(state, {
      type: "SAVE_SUCCEEDED",
      baseline: { name: "saved" },
      instanceId: "editor-a",
      operationId: 2,
    });
    state = reduce(state, {
      type: "PUBLICATION_SUCCEEDED",
      instanceId: "editor-a",
      operationId: 2,
      stage: "save",
    });
    state = reduce(state, {
      type: "PUBLISH_STARTED",
      instanceId: "editor-a",
      operationId: 2,
    });
    state = reduce(state, {
      type: "PUBLISH_SUCCEEDED",
      instanceId: "editor-a",
      operationId: 2,
    });
    state = reduce(state, {
      type: "PUBLICATION_SUCCEEDED",
      instanceId: "editor-a",
      operationId: 2,
      stage: "publish",
    });

    expect(state).toMatchObject({
      operation: {
        committedBaseline: { name: "saved" },
        journal: {
          finalPublication: true,
          published: true,
          savePublication: true,
          saved: true,
          uploaded: true,
        },
        uploadedImages: [{ id: 7 }],
      },
      status: "preparing",
    });
  });

  it("keeps a confirmed deletion journal until publication completes", () => {
    const baseline = { name: "server" };
    const deletion = createEditorOperation<Baseline, Image>({
      committedBaseline: baseline,
      deletion: { imageId: 44, originalIndex: 2 },
      instanceId: "editor-a",
      intent: "delete-image",
      operationId: 2,
    });
    let state = reduce(hydrated(baseline), {
      type: "OPERATION_STARTED",
      accommodationId: 31,
      instanceId: "editor-a",
      operation: deletion,
    });

    expect(state.status).toBe("deleting-image");
    state = reduce(state, {
      type: "DELETE_RECONCILIATION_STARTED",
      instanceId: "editor-a",
      operationId: 2,
    });
    expect(state.status).toBe("reconciling-delete");
    state = reduce(state, {
      type: "DELETE_CONFIRMED",
      baseline: { name: "without image" },
      instanceId: "editor-a",
      operationId: 2,
    });

    expect(state).toMatchObject({
      operation: {
        baselineRevision: 1,
        committedBaseline: { name: "without image" },
        journal: { deletionReconciled: true },
      },
      status: "preparing",
    });
    state = reduce(state, {
      type: "PUBLICATION_SUCCEEDED",
      instanceId: "editor-a",
      operationId: 2,
      stage: "save",
    });
    state = reduce(state, {
      type: "DELETE_COMPLETED",
      instanceId: "editor-a",
      operationId: 2,
    });

    expect(state).toEqual({
      accommodationId: 31,
      baseline: { name: "without image" },
      baselineRevision: 1,
      instanceId: "editor-a",
      status: "ready",
    });
  });

  it.each([
    ["OPERATION_INVALID_RESOURCE", "invalid-resource"],
    ["OPERATION_DENIED", "denied"],
  ] as const)(
    "moves an active reconciliation through %s to the %s terminal",
    (type, status) => {
      const baseline = { name: "server" };
      const deletion = createEditorOperation<Baseline, Image>({
        committedBaseline: baseline,
        deletion: { imageId: 44, originalIndex: 2 },
        instanceId: "editor-a",
        intent: "delete-image",
        operationId: 2,
      });
      let state = reduce(hydrated(baseline), {
        type: "OPERATION_STARTED",
        accommodationId: 31,
        instanceId: "editor-a",
        operation: deletion,
      });
      state = reduce(state, {
        type: "DELETE_RECONCILIATION_STARTED",
        instanceId: "editor-a",
        operationId: 2,
      });

      const terminal = reduce(state, {
        type,
        error: new Error(status),
        instanceId: "editor-a",
        operationId: 2,
      });

      expect(terminal).toMatchObject({
        accommodationId: 31,
        error: expect.any(Error),
        instanceId: "editor-a",
        status,
      });
      expect(
        reduce(terminal, {
          type: "OPERATION_FAILED",
          error: new Error("late"),
          instanceId: "editor-a",
          operationId: 2,
          phase: "reconcile-delete",
          retry: "allowed",
        }),
      ).toBe(terminal);
    },
  );

  it("preserves a successful journal when an allowed retry gets a new operation id", () => {
    const baseline = { name: "server" };
    const operation = createEditorOperation<Baseline, Image>({
      committedBaseline: baseline,
      instanceId: "editor-a",
      intent: "publish",
      operationId: 2,
    });
    let state = reduce(hydrated(baseline), {
      type: "OPERATION_STARTED",
      accommodationId: 31,
      instanceId: "editor-a",
      operation,
    });
    state = reduce(state, {
      type: "SAVE_STARTED",
      instanceId: "editor-a",
      operationId: 2,
    });
    state = reduce(state, {
      type: "SAVE_SUCCEEDED",
      baseline: { name: "saved" },
      instanceId: "editor-a",
      operationId: 2,
    });
    state = reduce(state, {
      type: "OPERATION_FAILED",
      error: new Error("publication failed"),
      instanceId: "editor-a",
      operationId: 2,
      phase: "publication",
      retry: "allowed",
    });
    state = reduce(state, {
      type: "OPERATION_RETRY_STARTED",
      instanceId: "editor-a",
      operationId: 3,
      resumeStatus: "preparing",
    });

    expect(state).toMatchObject({
      operation: {
        committedBaseline: { name: "saved" },
        journal: { saved: true },
        operationId: 3,
      },
      status: "preparing",
    });
  });

  it("does not retry an operation whose mutation outcome is locked", () => {
    const baseline = { name: "server" };
    const operation = createEditorOperation<Baseline, Image>({
      committedBaseline: baseline,
      instanceId: "editor-a",
      intent: "publish",
      operationId: 2,
    });
    let state = reduce(hydrated(baseline), {
      type: "OPERATION_STARTED",
      accommodationId: 31,
      instanceId: "editor-a",
      operation,
    });
    state = reduce(state, {
      type: "PUBLISH_STARTED",
      instanceId: "editor-a",
      operationId: 2,
    });
    state = reduce(state, {
      type: "OPERATION_FAILED",
      error: new Error("unknown outcome"),
      instanceId: "editor-a",
      operationId: 2,
      phase: "publish",
      retry: "locked",
    });

    expect(
      reduce(state, {
        type: "OPERATION_RETRY_STARTED",
        instanceId: "editor-a",
        operationId: 3,
        resumeStatus: "preparing",
      }),
    ).toBe(state);
    expect(
      reduce(state, {
        instanceId: "editor-a",
        type: "ERROR_DISMISSED",
      }),
    ).toBe(state);
  });

  it("makes stale and completed states terminal and ignores old completions", () => {
    const ready = hydrated();
    const stale = reduce(ready, {
      type: "MARK_STALE",
      instanceId: "editor-a",
    });

    expect(stale.status).toBe("stale");
    expect(
      reduce(stale, {
        type: "HYDRATION_RETRY_STARTED",
        accommodationId: 31,
        instanceId: "editor-a",
        operationId: 2,
      }),
    ).toBe(stale);
  });
});
