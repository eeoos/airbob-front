import type { Mocked } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { accommodationAmenityCatalog } from "../../features/accommodations/public";
import { AppError } from "../../platform/http/errors";
import type {
  AuthenticatedSessionScope,
  SessionSubject,
} from "../../platform/session/sessionScope";
import { testSessionRuntimeLeaseId } from "../../test/sessionFixtures";
import type { ListingEditorAccommodation } from "../../features/accommodations/listing-editor/model/listingEditor";
import type { ListingEditorQueryPort } from "../../features/accommodations/listing-editor/public";
import type { AccommodationEditScreenProps } from "./editorViewContract";
import { AccommodationEditController } from "./AccommodationEditController";

let latestScreenProps: AccommodationEditScreenProps | null = null;

vi.mock("./AccommodationEditScreen", () => ({
  AccommodationEditScreen: (props: AccommodationEditScreenProps) => {
    latestScreenProps = props;
    return null;
  },
}));

const accommodation: ListingEditorAccommodation = {
  id: 3,
  name: "기존 숙소",
  description: "기존 설명",
  type: "ENTIRE_PLACE",
  basePrice: 120_000,
  currency: "KRW",
  checkInTime: "15:00:00",
  checkOutTime: "11:00:00",
  address: {
    postalCode: "12345",
    country: "대한민국",
    state: "서울특별시",
    city: "서울특별시",
    district: "마포구",
    street: "월드컵로 1",
    detail: "101호",
  },
  occupancyPolicy: {
    maxOccupancy: 4,
    infantOccupancy: 1,
    petOccupancy: 0,
  },
  amenities: [{ name: "WIFI", count: 1 }],
  images: [{ id: 31, imageUrl: "/room.jpg" }],
};

const scope: AuthenticatedSessionScope = {
  subject: "subject:member_7" as SessionSubject,
  epoch: 1,
  runtimeLeaseId: testSessionRuntimeLeaseId,
};

const deferred = <Value,>() => {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
};

const validationError = () =>
  new AppError({
    code: "VALIDATION_ERROR",
    kind: "validation",
    message: "invalid",
  });

const networkError = () =>
  new AppError({
    code: "NETWORK_ERROR",
    kind: "network",
    message: "network failed",
    retryable: true,
  });

const createProps = () => {
  const api = {
    getHostDetail: vi.fn().mockResolvedValue(accommodation),
    update: vi.fn().mockResolvedValue(undefined),
    uploadImages: vi.fn().mockResolvedValue([]),
    deleteImage: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(undefined),
  };
  const publication = {
    publishEditorChanged: vi.fn().mockResolvedValue(undefined),
  };
  const query: Mocked<ListingEditorQueryPort> = {
    getHostDetail: vi.fn((accommodationId, options) =>
      api.getHostDetail(accommodationId, { signal: options.signal }),
    ),
    projectHostDetail: vi.fn(),
    setHostDetail: vi.fn(),
  };
  const onNavigateToHostProfile = vi.fn();

  return {
    accommodationId: 3,
    amenityCatalog: accommodationAmenityCatalog,
    addressSearch: {
      search: vi.fn(),
    },
    api,
    instanceId: "editor:test:3:epoch-1",
    isNewDraft: false,
    onNavigateToHostProfile,
    publication,
    query,
    resolveImageUrl: (path: string | null | undefined) => path ?? "",
    routeLease: { isCurrent: () => true },
    session: {
      captureAuthenticatedSession: () => scope,
      isCurrentSession: () => true,
    },
  };
};

const currentScreen = (): AccommodationEditScreenProps => {
  if (!latestScreenProps) throw new Error("screen props were not captured");
  return latestScreenProps;
};

const renderReadyController = async (props: ReturnType<typeof createProps>) => {
  render(<AccommodationEditController {...props} />);
  await waitFor(() =>
    expect(currentScreen().state.detailState.status).toBe("ready"),
  );
};

const selectPendingImage = (name = "pending.png") => {
  const file = new File(["image"], name, { type: "image/png" });
  act(() =>
    currentScreen().actions.onImageSelect({
      target: { files: [file], value: name },
    } as never),
  );
};

beforeEach(() => {
  latestScreenProps = null;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn((file: File) => `blob:${file.name}`),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("AccommodationEditController", () => {
  it("hydrates the matching detail and exposes the wizard atomically", async () => {
    const props = createProps();
    render(<AccommodationEditController {...props} />);

    expect(currentScreen().state.detailState.status).toBe("loading");
    await waitFor(() =>
      expect(currentScreen().state.detailState.status).toBe("ready"),
    );

    expect(currentScreen().state.formData.name).toBe("기존 숙소");
    expect(currentScreen().state.amenitySemantics).toEqual([
      { isKnown: true, label: "무선 인터넷", name: "WIFI" },
    ]);
    expect(currentScreen().state.imageItems).toEqual([
      { clientId: "server:31", id: 31, url: "/room.jpg" },
    ]);
    expect(props.api.getHostDetail).toHaveBeenCalledTimes(1);
    expect(props.query.getHostDetail).toHaveBeenCalledWith(3, {
      scope,
      signal: expect.any(AbortSignal),
    });
  });

  it("passes an explicit unknown-amenity signal into editor presentation", async () => {
    const props = createProps();
    props.api.getHostDetail.mockResolvedValue({
      ...accommodation,
      amenities: [{ name: "FUTURE_AMENITY", count: 1 }],
    });

    await renderReadyController(props);

    expect(currentScreen().state.amenitySemantics).toEqual([
      {
        isKnown: false,
        label: "알 수 없는 편의시설",
        name: "FUTURE_AMENITY",
      },
    ]);
  });

  it("orders rapid semantic commands through the single draft writer", async () => {
    const props = createProps();
    await renderReadyController(props);

    act(() => {
      currentScreen().actions.onGuestIncrement();
      currentScreen().actions.onGuestIncrement();
      currentScreen().actions.onAmenityIncrement("WIFI");
      currentScreen().actions.onAmenityIncrement("WIFI");
    });

    expect(
      currentScreen().state.formData.occupancyPolicyInfo.maxOccupancy,
    ).toBe("6");
    expect(currentScreen().state.formData.amenityInfos).toEqual([
      { name: "WIFI", count: 3 },
    ]);
  });

  it("closes and reopens editor overlays without mutating unrelated fields", async () => {
    const props = createProps();
    await renderReadyController(props);
    const originalForm = currentScreen().state.formData;

    act(() => currentScreen().actions.onOpenAmenityModal());
    expect(currentScreen().state.isAmenityModalOpen).toBe(true);
    act(() => currentScreen().actions.onCloseAmenityModal());
    act(() => currentScreen().actions.onOpenAmenityModal());
    expect(currentScreen().state.isAmenityModalOpen).toBe(true);
    act(() => currentScreen().actions.onCloseAmenityModal());

    act(() => currentScreen().actions.onOpenTypeModal());
    act(() => currentScreen().actions.onCloseTypeModal());
    act(() => currentScreen().actions.onOpenTypeModal());
    expect(currentScreen().state.isTypeModalOpen).toBe(true);

    act(() =>
      currentScreen().actions.onAccommodationTypeSelect("PRIVATE_ROOM"),
    );
    expect(currentScreen().state.isTypeModalOpen).toBe(false);
    expect(currentScreen().state.formData).toEqual({
      ...originalForm,
      type: "PRIVATE_ROOM",
    });

    act(() => currentScreen().actions.onTimePickerOpen("checkIn"));
    act(() => currentScreen().actions.onTimePickerClose());
    act(() => currentScreen().actions.onTimePickerOpen("checkOut"));
    expect(currentScreen().state.openTimePicker).toBe("checkOut");
    expect(currentScreen().state.formData).toEqual({
      ...originalForm,
      type: "PRIVATE_ROOM",
    });
  });

  it("shares deferred hydration through StrictMode effect replay", async () => {
    const props = createProps();
    const hydration = deferred<ListingEditorAccommodation>();
    props.api.getHostDetail.mockReturnValue(hydration.promise);

    render(
      <StrictMode>
        <AccommodationEditController {...props} />
      </StrictMode>,
    );
    await waitFor(() =>
      expect(props.api.getHostDetail).toHaveBeenCalledTimes(1),
    );

    await act(async () => {
      hydration.resolve(accommodation);
      await hydration.promise;
    });
    await waitFor(() =>
      expect(currentScreen().state.detailState.status).toBe("ready"),
    );
    expect(props.api.getHostDetail).toHaveBeenCalledTimes(1);
  });

  it("maps authorization failure to the denied terminal", async () => {
    const props = createProps();
    props.api.getHostDetail.mockRejectedValue(
      new AppError({
        code: "FORBIDDEN",
        kind: "http",
        message: "forbidden",
        status: 403,
      }),
    );
    render(<AccommodationEditController {...props} />);

    await waitFor(() =>
      expect(currentScreen().state.detailState.status).toBe("denied"),
    );
    expect(currentScreen().state.isEditorReady).toBe(false);
  });

  it("serializes step save and publish even when each action is triggered twice", async () => {
    const props = createProps();
    const update = deferred<void>();
    const publish = deferred<void>();
    props.api.update.mockReturnValue(update.promise);
    props.api.publish.mockReturnValue(publish.promise);
    render(<AccommodationEditController {...props} />);
    await waitFor(() =>
      expect(currentScreen().state.detailState.status).toBe("ready"),
    );

    act(() => currentScreen().actions.onStepClick(4));
    act(() => currentScreen().actions.onFieldChange("name", "변경한 숙소"));
    act(() => {
      void currentScreen().actions.onNext();
      void currentScreen().actions.onNext();
    });
    await waitFor(() => expect(props.api.update).toHaveBeenCalledTimes(1));
    expect(props.api.update).toHaveBeenCalledWith(
      3,
      { name: "변경한 숙소" },
      { signal: expect.any(AbortSignal) },
    );

    await act(async () => {
      update.resolve();
      await update.promise;
    });
    await waitFor(() => expect(currentScreen().state.currentStep).toBe(5));

    const event = { preventDefault: vi.fn() } as never;
    act(() => {
      void currentScreen().actions.onPublishSubmit(event);
      void currentScreen().actions.onPublishSubmit(event);
    });
    await waitFor(() => expect(props.api.publish).toHaveBeenCalledTimes(1));

    await act(async () => {
      publish.resolve();
      await publish.promise;
    });
    await waitFor(() =>
      expect(props.onNavigateToHostProfile).toHaveBeenCalledTimes(1),
    );
    expect(props.publication.publishEditorChanged).toHaveBeenCalledTimes(2);
    expect(props.query.projectHostDetail).toHaveBeenCalledWith({
      accommodationId: 3,
      fallback: expect.objectContaining({ name: "변경한 숙소" }),
      projection: {
        kind: "apply-update",
        update: { name: "변경한 숙소" },
      },
      scope,
    });
  });

  it("persists null-source defaults without relying on draft route state", async () => {
    const props = createProps();
    props.isNewDraft = false;
    props.api.getHostDetail.mockResolvedValue({
      ...accommodation,
      checkInTime: null,
      checkOutTime: null,
      occupancyPolicy: null,
    });
    await renderReadyController(props);

    act(() => currentScreen().actions.onSaveAndExit());
    await waitFor(() =>
      expect(props.onNavigateToHostProfile).toHaveBeenCalledTimes(1),
    );

    expect(props.api.update).toHaveBeenCalledWith(
      3,
      {
        checkInTime: "15:00",
        checkOutTime: "11:00",
        occupancyPolicy: {
          maxOccupancy: 1,
          infantOccupancy: 0,
          petOccupancy: 0,
        },
      },
      { signal: expect.any(AbortSignal) },
    );
  });

  it("confirms a missing detail address before upload, save, publication, and exit", async () => {
    const props = createProps();
    const order: string[] = [];
    props.api.getHostDetail.mockResolvedValue({
      ...accommodation,
      address: { ...accommodation.address!, detail: null },
    });
    props.api.uploadImages.mockImplementation(async () => {
      order.push("upload");
      return [{ id: 32, imageUrl: "/pending.jpg" }];
    });
    props.api.update.mockImplementation(async () => {
      order.push("update");
    });
    props.publication.publishEditorChanged.mockImplementation(
      async ({ outcome }) => {
        order.push(`publication:${outcome}`);
      },
    );
    props.onNavigateToHostProfile.mockImplementation(() => {
      order.push("navigate");
    });
    await renderReadyController(props);

    selectPendingImage();
    act(() => currentScreen().actions.onFieldChange("name", "저장할 숙소"));
    act(() => currentScreen().actions.onSaveAndExit());

    expect(currentScreen().state.showDetailAddressConfirm).toBe(true);
    expect(props.api.uploadImages).not.toHaveBeenCalled();

    act(() => currentScreen().actions.onConfirmDetailAddress());
    await waitFor(() =>
      expect(props.onNavigateToHostProfile).toHaveBeenCalledTimes(1),
    );

    expect(order).toEqual([
      "upload",
      "update",
      "publication:saved",
      "navigate",
    ]);
    expect(props.api.update).toHaveBeenCalledWith(
      3,
      { name: "저장할 숙소" },
      { signal: expect.any(AbortSignal) },
    );
  });

  it("does not update, publish, or navigate when a confirmed upload fails", async () => {
    const props = createProps();
    props.api.getHostDetail.mockResolvedValue({
      ...accommodation,
      address: { ...accommodation.address!, detail: null },
    });
    props.api.uploadImages.mockRejectedValue(validationError());
    await renderReadyController(props);

    selectPendingImage("broken.png");
    act(() =>
      currentScreen().actions.onFieldChange("name", "저장하지 못할 숙소"),
    );
    act(() => currentScreen().actions.onSaveAndExit());
    act(() => currentScreen().actions.onConfirmDetailAddress());

    await waitFor(() => expect(currentScreen().state.error).not.toBeNull());
    expect(props.api.uploadImages).toHaveBeenCalledTimes(1);
    expect(props.api.update).not.toHaveBeenCalled();
    expect(props.publication.publishEditorChanged).not.toHaveBeenCalled();
    expect(props.onNavigateToHostProfile).not.toHaveBeenCalled();
  });

  it("uses a new save-exit intent after a safe advance failure", async () => {
    const props = createProps();
    props.api.update
      .mockRejectedValueOnce(validationError())
      .mockResolvedValueOnce(undefined);
    await renderReadyController(props);

    act(() => currentScreen().actions.onStepClick(4));
    act(() => currentScreen().actions.onFieldChange("name", "변경한 숙소"));
    act(() => currentScreen().actions.onNext());
    await waitFor(() => expect(currentScreen().state.error).not.toBeNull());

    act(() => currentScreen().actions.onSaveAndExit());
    await waitFor(() =>
      expect(props.onNavigateToHostProfile).toHaveBeenCalledTimes(1),
    );

    expect(props.api.update).toHaveBeenCalledTimes(2);
    expect(currentScreen().state.currentStep).toBe(4);
  });

  it("keeps the committed advance recovery when a new intent cannot dismiss it", async () => {
    const props = createProps();
    props.publication.publishEditorChanged
      .mockRejectedValueOnce(new Error("publication failed"))
      .mockResolvedValueOnce(undefined);
    await renderReadyController(props);

    act(() => currentScreen().actions.onStepClick(4));
    act(() => currentScreen().actions.onFieldChange("name", "저장된 숙소"));
    act(() => currentScreen().actions.onNext());
    await waitFor(() => expect(currentScreen().state.error).not.toBeNull());

    act(() => currentScreen().actions.onSaveAndExit());
    expect(currentScreen().state.currentStep).toBe(4);
    expect(props.publication.publishEditorChanged).toHaveBeenCalledTimes(1);

    act(() => currentScreen().actions.onRetryRecovery());
    await waitFor(() => expect(currentScreen().state.currentStep).toBe(5));

    expect(props.api.update).toHaveBeenCalledTimes(1);
    expect(props.publication.publishEditorChanged).toHaveBeenCalledTimes(2);
    expect(props.onNavigateToHostProfile).not.toHaveBeenCalled();
  });

  it("locks protected recovery edits until an explicit retry completes the retained save", async () => {
    const props = createProps();
    props.publication.publishEditorChanged
      .mockRejectedValueOnce(new Error("publication failed"))
      .mockResolvedValueOnce(undefined);
    await renderReadyController(props);

    act(() =>
      currentScreen().actions.onFieldChange("name", "서버에 저장된 이름"),
    );
    act(() => currentScreen().actions.onSaveAndExit());
    await waitFor(() =>
      expect(currentScreen().state.recoveryState).toBe("protected-command"),
    );

    act(() => {
      currentScreen().actions.onFieldChange("name", "복구 중 유실될 이름");
      currentScreen().actions.onFieldChange(
        "description",
        "복구 중 유실될 설명",
      );
      currentScreen().actions.onOpenAmenityModal();
      currentScreen().actions.onStepClick(4);
    });
    selectPendingImage("blocked.png");

    expect(currentScreen().state.formData.name).toBe("서버에 저장된 이름");
    expect(currentScreen().state.formData.description).toBe("기존 설명");
    expect(currentScreen().state.imageItems).toHaveLength(1);
    expect(currentScreen().state.isAmenityModalOpen).toBe(false);
    expect(currentScreen().state.currentStep).toBe(1);

    act(() => currentScreen().actions.onClearError());
    expect(currentScreen().state.recoveryState).toBe("protected-command");
    expect(props.publication.publishEditorChanged).toHaveBeenCalledTimes(1);

    act(() => currentScreen().actions.onRetryRecovery());
    await waitFor(() =>
      expect(props.onNavigateToHostProfile).toHaveBeenCalledTimes(1),
    );

    expect(props.api.update).toHaveBeenCalledTimes(1);
    expect(props.publication.publishEditorChanged).toHaveBeenCalledTimes(2);
  });

  it("chains delete reconciliation into the latest save-exit intent without repeating DELETE", async () => {
    const props = createProps();
    const images = [
      { id: 31, imageUrl: "/one.jpg" },
      { id: 32, imageUrl: "/two.jpg" },
    ];
    const detail = { ...accommodation, images };
    props.api.getHostDetail
      .mockResolvedValueOnce(detail)
      .mockRejectedValueOnce(networkError())
      .mockResolvedValueOnce({
        ...detail,
        images: [{ id: 32, imageUrl: "/two.jpg" }],
      });
    props.api.deleteImage.mockRejectedValueOnce(networkError());
    await renderReadyController(props);

    act(() =>
      currentScreen().actions.onFieldChange("name", "삭제 후 저장할 이름"),
    );
    act(() => currentScreen().actions.onImageRemove(0));
    await waitFor(() =>
      expect(currentScreen().state.recoveryState).toBe("protected-delete"),
    );

    act(() => currentScreen().actions.onSaveAndExit());
    await waitFor(() =>
      expect(props.onNavigateToHostProfile).toHaveBeenCalledTimes(1),
    );

    expect(props.api.deleteImage).toHaveBeenCalledTimes(1);
    expect(props.api.getHostDetail).toHaveBeenCalledTimes(3);
    expect(props.api.update).toHaveBeenCalledWith(
      3,
      { name: "삭제 후 저장할 이름" },
      { signal: expect.any(AbortSignal) },
    );
  });

  it("consumes a cumulative uploaded image batch only once across save retry", async () => {
    const props = createProps();
    props.api.uploadImages.mockResolvedValueOnce([
      { id: 32, imageUrl: "/uploaded.jpg" },
    ]);
    props.api.update
      .mockRejectedValueOnce(validationError())
      .mockResolvedValueOnce(undefined);
    await renderReadyController(props);

    selectPendingImage("retry.png");
    act(() => currentScreen().actions.onFieldChange("name", "재시도할 숙소"));
    act(() => currentScreen().actions.onSaveAndExit());
    await waitFor(() => expect(currentScreen().state.error).not.toBeNull());
    expect(currentScreen().state.imageItems.map((image) => image.id)).toEqual([
      31, 32,
    ]);

    act(() => currentScreen().actions.onSaveAndExit());
    await waitFor(() =>
      expect(props.onNavigateToHostProfile).toHaveBeenCalledTimes(1),
    );

    expect(props.api.uploadImages).toHaveBeenCalledTimes(1);
    expect(currentScreen().state.imageItems.map((image) => image.id)).toEqual([
      31, 32,
    ]);
    expect(currentScreen().state.error).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("restores a definitively rejected image at its original index", async () => {
    const props = createProps();
    const images = [
      { id: 31, imageUrl: "/one.jpg" },
      { id: 32, imageUrl: "/two.jpg" },
      { id: 33, imageUrl: "/three.jpg" },
    ];
    props.api.getHostDetail.mockResolvedValue({ ...accommodation, images });
    props.api.deleteImage.mockRejectedValue(validationError());
    await renderReadyController(props);

    act(() => currentScreen().actions.onImageRemove(1));
    await waitFor(() =>
      expect(currentScreen().state.imageItems.map((image) => image.id)).toEqual(
        [31, 32, 33],
      ),
    );

    expect(props.api.deleteImage).toHaveBeenCalledTimes(1);
    expect(props.api.getHostDetail).toHaveBeenCalledTimes(1);
  });

  it("blocks commands during reconciliation and restores a rejected deletion in place", async () => {
    const props = createProps();
    const images = [
      { id: 31, imageUrl: "/one.jpg" },
      { id: 32, imageUrl: "/two.jpg" },
      { id: 33, imageUrl: "/three.jpg" },
    ];
    const detail = { ...accommodation, images };
    const reconciliation = deferred<ListingEditorAccommodation>();
    props.api.getHostDetail
      .mockResolvedValueOnce(detail)
      .mockReturnValueOnce(reconciliation.promise);
    props.api.deleteImage.mockRejectedValue(networkError());
    await renderReadyController(props);

    act(() => currentScreen().actions.onStepClick(5));
    act(() => currentScreen().actions.onImageRemove(1));
    await waitFor(() =>
      expect(props.api.getHostDetail).toHaveBeenCalledTimes(2),
    );
    expect(currentScreen().state.isDeletingImage).toBe(true);
    expect(currentScreen().state.isSaving).toBe(true);

    const publishEvent = { preventDefault: vi.fn() } as never;
    act(() => {
      currentScreen().actions.onNext();
      currentScreen().actions.onSaveAndExit();
      void currentScreen().actions.onPublishSubmit(publishEvent);
    });
    expect(props.api.update).not.toHaveBeenCalled();
    expect(props.api.publish).not.toHaveBeenCalled();
    expect(props.onNavigateToHostProfile).not.toHaveBeenCalled();

    await act(async () => {
      reconciliation.resolve(detail);
      await reconciliation.promise;
    });
    await waitFor(() =>
      expect(currentScreen().state.imageItems.map((image) => image.id)).toEqual(
        [31, 32, 33],
      ),
    );
    expect(props.api.update).not.toHaveBeenCalled();
    expect(props.api.publish).not.toHaveBeenCalled();
    expect(props.onNavigateToHostProfile).not.toHaveBeenCalled();
  });
});
