import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  ListingEditorApiPort,
  ListingEditorQueryPort,
} from "../../features/accommodations/listing-editor/public";
import type { AccommodationAmenityCatalog } from "../../features/accommodations/public";
import {
  createListingEditorWorkflow,
  type EditorPersistenceIntent,
  type ListingEditorCommandResult,
  type ListingEditorPublicationPort,
  type ListingEditorRouteLease,
  type ListingEditorSessionPort,
} from "../../workflows/listing-editor";
import { useStrictModeSafeDisposable } from "../../shared/lib/useStrictModeSafeDisposable";
import { AccommodationEditScreen } from "./AccommodationEditScreen";
import type {
  AccommodationEditDetailState,
  AccommodationEditFormData,
  AccommodationEditRecoveryState,
  AccommodationEditScreenActions,
  AccommodationEditScreenState,
  AccommodationEditStep,
} from "./editorViewContract";
import { toListingEditorErrorMessage } from "./listingEditorErrorMessage";
import {
  type ListingEditorAddressSearchPort,
  useListingEditorAddressSearch,
} from "./useListingEditorAddressSearch";
import { useListingEditorDraft } from "./useListingEditorDraft";
import { useListingEditorImages } from "./useListingEditorImages";

export interface AccommodationEditControllerProps {
  readonly accommodationId: number;
  readonly amenityCatalog: AccommodationAmenityCatalog;
  readonly addressSearch: ListingEditorAddressSearchPort;
  readonly api: ListingEditorApiPort;
  readonly instanceId: string;
  readonly isNewDraft: boolean;
  readonly publication: ListingEditorPublicationPort;
  readonly query: ListingEditorQueryPort;
  readonly resolveImageUrl: (imagePath: string | null | undefined) => string;
  readonly routeLease: ListingEditorRouteLease;
  readonly session: ListingEditorSessionPort;
  readonly onNavigateToHostProfile: () => void;
}

const commandInteractionLockedStatuses = new Set([
  "deleting-image",
  "reconciling-delete",
  "preparing",
  "uploading",
  "saving",
  "publishing",
]);

type ListingEditorMachineState = ReturnType<
  ReturnType<typeof createListingEditorWorkflow>["getState"]
>;

const toRecoveryState = (
  state: ListingEditorMachineState,
  canAcknowledgeError: boolean,
): AccommodationEditRecoveryState => {
  if (
    state.status !== "recoverable-error" ||
    state.retry !== "allowed" ||
    canAcknowledgeError
  ) {
    return "none";
  }

  return state.operation.intent === "delete-image"
    ? "protected-delete"
    : "protected-command";
};

const toDetailState = (
  status: ListingEditorMachineState["status"],
  accommodationId: number,
): AccommodationEditDetailState => {
  const id = String(accommodationId);
  switch (status) {
    case "invalid-resource":
      return { status, accommodationId: id };
    case "denied":
      return { status, accommodationId: id };
    case "retryable-load-error":
      return { status, accommodationId: id };
    case "hydrating":
    case "stale":
      return { status: "loading", accommodationId: id };
    default:
      return { status: "ready", accommodationId: id };
  }
};

const hasSnapshot = (
  result: ListingEditorCommandResult,
): result is Extract<
  ListingEditorCommandResult,
  { readonly accommodation: unknown }
> => "accommodation" in result;

export function AccommodationEditController({
  accommodationId,
  amenityCatalog,
  addressSearch,
  api,
  instanceId,
  isNewDraft,
  onNavigateToHostProfile,
  publication,
  query,
  resolveImageUrl,
  routeLease,
  session,
}: AccommodationEditControllerProps) {
  const [currentStep, setCurrentStep] = useState<AccommodationEditStep>(1);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isAmenityModalOpen, setIsAmenityModalOpen] = useState(false);
  const [pendingIntent, setPendingIntent] =
    useState<EditorPersistenceIntent | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const handleLocalError = useCallback((message: string) => {
    setLocalError(message);
  }, []);
  const draft = useListingEditorDraft();
  const images = useListingEditorImages({ onError: handleLocalError });
  const { commitBaseline: commitDraftBaseline, hydrate: hydrateDraft } = draft;
  const {
    applyUploaded: applyUploadedImages,
    hydrate: hydrateImages,
    restore: restoreImage,
  } = images;
  const pendingDeleteTombstonesRef = useRef(
    new Map<number, ReturnType<typeof images.removeAt>>(),
  );
  const consumedUploadedImageIdsRef = useRef(new Set<number>());
  const appliedBaselineRevisionRef = useRef(-1);
  const hydratedRef = useRef(false);

  const continuation = useMemo(
    () => ({
      complete({ intent }: { readonly intent: EditorPersistenceIntent }) {
        if (intent === "advance") {
          setCurrentStep((step) =>
            step < 5 ? ((step + 1) as AccommodationEditStep) : step,
          );
          return;
        }
        onNavigateToHostProfile();
      },
    }),
    [onNavigateToHostProfile],
  );

  const workflow = useMemo(
    () =>
      createListingEditorWorkflow({
        accommodationId,
        api,
        continuation,
        instanceId,
        publication,
        query,
        routeLease,
        session,
      }),
    [
      accommodationId,
      api,
      continuation,
      instanceId,
      publication,
      query,
      routeLease,
      session,
    ],
  );
  useStrictModeSafeDisposable(workflow);

  const subscribe = useCallback(
    (notify: () => void) => workflow.subscribe(() => notify()),
    [workflow],
  );
  const machineState = useSyncExternalStore(
    subscribe,
    workflow.getState,
    workflow.getState,
  );

  const applyCommandResult = useCallback(
    (result: ListingEditorCommandResult) => {
      if (result.status === "delete-rejected") {
        const tombstone = pendingDeleteTombstonesRef.current.get(
          result.imageId,
        );
        if (tombstone) restoreImage(tombstone);
        pendingDeleteTombstonesRef.current.delete(result.imageId);
        workflow.acknowledgeError();
        setLocalError(toListingEditorErrorMessage(result.error));
        return;
      }

      if (!hasSnapshot(result)) return;

      pendingDeleteTombstonesRef.current.forEach((_, imageId) => {
        if (
          !result.accommodation.images.some((image) => image.id === imageId)
        ) {
          pendingDeleteTombstonesRef.current.delete(imageId);
        }
      });

      if (result.baselineRevision <= appliedBaselineRevisionRef.current) {
        return;
      }

      if (!hydratedRef.current) {
        hydratedRef.current = true;
        hydrateDraft(result.accommodation);
        hydrateImages(result.accommodation.images);
      } else {
        if ("uploadedImages" in result && result.uploadedImages.length > 0) {
          const unconsumedImages = result.uploadedImages.filter(
            (image) => !consumedUploadedImageIdsRef.current.has(image.id),
          );
          if (
            unconsumedImages.length > 0 &&
            applyUploadedImages(unconsumedImages)
          ) {
            unconsumedImages.forEach((image) =>
              consumedUploadedImageIdsRef.current.add(image.id),
            );
          }
        }
        commitDraftBaseline(result.accommodation);
      }
      appliedBaselineRevisionRef.current = result.baselineRevision;
    },
    [
      applyUploadedImages,
      commitDraftBaseline,
      hydrateDraft,
      hydrateImages,
      restoreImage,
      workflow,
    ],
  );

  useEffect(() => {
    void workflow.hydrate().then(applyCommandResult);
  }, [applyCommandResult, workflow]);

  const prepareDraftEdit = useCallback((): boolean => {
    const state = workflow.getState();
    if (state.status === "ready") return true;
    if (
      state.status === "recoverable-error" &&
      state.retry === "allowed" &&
      workflow.canAcknowledgeError()
    ) {
      return workflow.acknowledgeError();
    }
    return false;
  }, [workflow]);

  const handleAddressSelected = useCallback(
    (address: AccommodationEditFormData["addressInfo"]) => {
      if (!prepareDraftEdit()) return;
      draft.replaceAddress(address);
    },
    [draft, prepareDraftEdit],
  );
  const { openAddressSearch } = useListingEditorAddressSearch({
    onAddressSelected: handleAddressSelected,
    onError: handleLocalError,
    port: addressSearch,
  });

  const runPersistence = useCallback(
    async (intent: EditorPersistenceIntent) => {
      const state = workflow.getState();
      const recoveryState = toRecoveryState(
        state,
        workflow.canAcknowledgeError(),
      );
      const shouldRetry =
        state.status === "recoverable-error" &&
        state.retry === "allowed" &&
        recoveryState !== "protected-delete" &&
        (state.operation.intent === intent || !workflow.acknowledgeError());
      let result: ListingEditorCommandResult;
      if (shouldRetry) {
        result = await workflow.retry();
      } else {
        const captured = draft.capturePersistence();
        if (!captured) return;
        result = await workflow.execute({
          intent,
          pendingFiles:
            intent === "advance" && currentStep !== 2 && currentStep !== 4
              ? []
              : images.getPendingFiles(),
          update:
            intent === "advance" && currentStep !== 4 ? {} : captured.update,
          onUploadProgress: images.setUploadProgress,
        });
      }
      applyCommandResult(result);
      images.setUploadProgress(0);
    },
    [applyCommandResult, currentStep, draft, images, workflow],
  );

  const requestIntent = useCallback(
    (intent: EditorPersistenceIntent) => {
      const state = workflow.getState();
      const recoveryState = toRecoveryState(
        state,
        workflow.canAcknowledgeError(),
      );
      if (
        state.status !== "ready" &&
        !(
          state.status === "recoverable-error" &&
          state.retry === "allowed" &&
          (recoveryState === "none" ||
            (recoveryState === "protected-delete" && intent === "save-exit"))
        )
      ) {
        return;
      }

      const mustConfirmAddress =
        !draft.formData.addressInfo.detail.trim() &&
        (intent === "publish" || currentStep === 1);
      if (mustConfirmAddress) {
        setPendingIntent(intent);
        return;
      }
      void runPersistence(intent);
    },
    [currentStep, draft.formData.addressInfo.detail, runPersistence, workflow],
  );

  const handleImageRemove = useCallback(
    (index: number) => {
      if (workflow.getState().status !== "ready") return;
      const tombstone = images.removeAt(index);
      if (!tombstone?.image.id) return;
      pendingDeleteTombstonesRef.current.set(tombstone.image.id, tombstone);
      void workflow
        .deleteImage({
          imageId: tombstone.image.id,
          originalIndex: tombstone.originalIndex,
        })
        .then(applyCommandResult);
    },
    [applyCommandResult, images, workflow],
  );

  const isStepCompleted = useCallback(
    (step: AccommodationEditStep) =>
      draft.isStepCompleted(step, {
        imageCount: images.imageItems.length,
        isNewDraft,
      }),
    [draft, images.imageItems.length, isNewDraft],
  );

  const recoveryState = toRecoveryState(
    machineState,
    workflow.canAcknowledgeError(),
  );
  const machineAllowsNavigation =
    machineState.status === "ready" ||
    (machineState.status === "recoverable-error" &&
      machineState.retry === "allowed" &&
      recoveryState === "none");
  const canProceedToNext =
    Boolean(draft.baseline) &&
    machineAllowsNavigation &&
    isStepCompleted(currentStep);

  const isStepClickable = useCallback(
    (targetStep: AccommodationEditStep) => {
      if (machineState.status !== "ready" || !draft.baseline) return false;
      if (isNewDraft) {
        for (let step = 1; step < targetStep; step += 1) {
          if (!isStepCompleted(step as AccommodationEditStep)) return false;
        }
        return true;
      }
      return (
        isStepCompleted(targetStep) ||
        (isStepCompleted(currentStep) && targetStep === currentStep + 1) ||
        targetStep < currentStep
      );
    },
    [
      currentStep,
      draft.baseline,
      isNewDraft,
      isStepCompleted,
      machineState.status,
    ],
  );

  const retryRecovery = useCallback(() => {
    const state = workflow.getState();
    if (toRecoveryState(state, workflow.canAcknowledgeError()) === "none") {
      return;
    }
    void workflow.retry().then((result) => {
      applyCommandResult(result);
      images.setUploadProgress(0);
    });
  }, [applyCommandResult, images, workflow]);

  const lockedAmbiguous =
    machineState.status === "recoverable-error" &&
    machineState.retry === "locked";
  const isSaving =
    commandInteractionLockedStatuses.has(machineState.status) ||
    lockedAmbiguous;
  const isDeletingImage =
    machineState.status === "deleting-image" ||
    machineState.status === "reconciling-delete";
  const machineError =
    machineState.status === "recoverable-error"
      ? toListingEditorErrorMessage(machineState.error, {
          ambiguous: machineState.retry === "locked",
        })
      : null;
  const amenityOptions = useMemo(
    () =>
      amenityCatalog.knownAmenities.map(({ code, label }) => ({
        label,
        name: code,
      })),
    [amenityCatalog],
  );
  const amenitySemantics = useMemo(
    () =>
      draft.formData.amenityInfos.map(({ name }) => {
        const semanticAmenity = amenityCatalog.resolve(name);
        return {
          isKnown: semanticAmenity.isKnown,
          label: semanticAmenity.label,
          name,
        };
      }),
    [amenityCatalog, draft.formData.amenityInfos],
  );

  const state: AccommodationEditScreenState = {
    amenityOptions,
    amenitySemantics,
    canProceedToNext,
    currentStep,
    detailState: toDetailState(machineState.status, accommodationId),
    dragOverIndex: images.dragOverIndex,
    draggedIndex: images.draggedIndex,
    error: localError ?? machineError,
    formData: draft.formData,
    imageItems: images.imageItems,
    isAmenityModalOpen,
    isDeletingImage,
    isEditorReady: draft.baseline !== null,
    isSaving,
    isTypeModalOpen,
    openTimePicker: draft.openTimePicker,
    recoveryState,
    showDetailAddressConfirm: pendingIntent !== null,
    uploadProgress: images.uploadProgress,
  };

  const actions: AccommodationEditScreenActions = {
    isStepClickable,
    isStepCompleted,
    onAddressSearch: () => {
      if (!prepareDraftEdit()) return;
      openAddressSearch();
    },
    onBack: () => {
      if (machineState.status === "ready" && currentStep > 1) {
        setCurrentStep((step) => (step - 1) as AccommodationEditStep);
      }
    },
    onClearError: () => {
      setLocalError(null);
      const state = workflow.getState();
      if (
        state.status === "recoverable-error" &&
        state.retry === "allowed" &&
        workflow.canAcknowledgeError()
      ) {
        workflow.acknowledgeError();
      }
    },
    onCloseAmenityModal: () => setIsAmenityModalOpen(false),
    onCloseDetailAddressConfirm: () => setPendingIntent(null),
    onCloseTypeModal: () => setIsTypeModalOpen(false),
    onConfirmDetailAddress: () => {
      const intent = pendingIntent;
      setPendingIntent(null);
      if (intent) void runPersistence(intent);
    },
    onDetailChange: (value) => {
      if (!prepareDraftEdit()) return;
      draft.changeAddressDetail(value);
    },
    onDragEnd: (event) => {
      if (!prepareDraftEdit()) return;
      images.handleDragEnd(event);
    },
    onDragOver: images.handleDragOver,
    onDragOverItem: (event, index) => {
      if (!prepareDraftEdit()) return;
      images.handleDragOverItem(event, index);
    },
    onDragStart: (index) => {
      if (!prepareDraftEdit()) return;
      images.handleDragStart(index);
    },
    onDrop: (event) => {
      if (!prepareDraftEdit()) return;
      images.handleDrop(event);
    },
    onExitDetailError: onNavigateToHostProfile,
    onImageRemove: handleImageRemove,
    onImageSelect: (event) => {
      if (!prepareDraftEdit()) return;
      images.handleImageSelect(event);
    },
    onFieldChange: (field, value) => {
      if (!prepareDraftEdit()) return;
      draft.changeField(field, value);
    },
    onOccupancyChange: (field, value) => {
      if (!prepareDraftEdit()) return;
      draft.changeOccupancy(field, value);
    },
    onGuestIncrement: () => {
      if (!prepareDraftEdit()) return;
      draft.incrementGuest();
    },
    onGuestDecrement: () => {
      if (!prepareDraftEdit()) return;
      draft.decrementGuest();
    },
    onAmenityToggle: (name) => {
      if (!prepareDraftEdit()) return;
      draft.toggleAmenity(name);
    },
    onAmenityIncrement: (name) => {
      if (!prepareDraftEdit()) return;
      draft.incrementAmenity(name);
    },
    onAmenityDecrement: (name) => {
      if (!prepareDraftEdit()) return;
      draft.decrementAmenity(name);
    },
    onAmenityRemove: (name) => {
      if (!prepareDraftEdit()) return;
      draft.removeAmenity(name);
    },
    onNext: () => {
      if (canProceedToNext) requestIntent("advance");
    },
    onOpenAmenityModal: () => {
      if (prepareDraftEdit()) setIsAmenityModalOpen(true);
    },
    onOpenTypeModal: () => {
      if (prepareDraftEdit()) setIsTypeModalOpen(true);
    },
    onPublishSubmit: async (event) => {
      event.preventDefault();
      if (currentStep === 5 && canProceedToNext) requestIntent("publish");
    },
    onRetryDetail: () => {
      void workflow.retry().then(applyCommandResult);
    },
    onRetryRecovery: retryRecovery,
    onSaveAndExit: () => requestIntent("save-exit"),
    onStepClick: (stepNumber) => {
      const target = stepNumber as AccommodationEditStep;
      if (isStepClickable(target)) setCurrentStep(target);
    },
    onTimePickerOpen: (picker) => {
      if (!prepareDraftEdit()) return;
      draft.openTimePickerCommand(picker);
    },
    onTimePickerClose: () => {
      if (!prepareDraftEdit()) return;
      draft.closeTimePicker();
    },
    onTimeValueSelect: (type, selection) => {
      if (!prepareDraftEdit()) return;
      draft.selectTimeValue(type, selection);
    },
    onAccommodationTypeSelect: (type) => {
      if (!prepareDraftEdit()) return;
      if (draft.selectAccommodationType(type)) setIsTypeModalOpen(false);
    },
    resolveImageUrl,
  };

  return <AccommodationEditScreen state={state} actions={actions} />;
}
