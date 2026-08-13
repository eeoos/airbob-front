import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { accommodationQueryKeys } from "../../queryKeys";
import { profileQueryKeys } from "../../../profile/queryKeys";
import {
  AccommodationEditFormData,
  createDefaultAccommodationEditFormData,
} from "../lib/accommodationEditMapper";
import { AccommodationEditImageItem } from "../lib/imageItems";
import { useAccommodationEditSave } from "./useAccommodationEditSave";

jest.mock("../../../../api", () => ({
  accommodationApi: {
    update: jest.fn(),
    publish: jest.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return { queryClient, wrapper };
};

const createFilledFormData = (
  overrides: Partial<AccommodationEditFormData> = {}
): AccommodationEditFormData => ({
  ...createDefaultAccommodationEditFormData(),
  name: "기존 숙소",
  description: "기존 설명",
  basePrice: "120000",
  type: "ENTIRE_PLACE",
  addressInfo: {
    postalCode: "12345",
    country: "대한민국",
    state: "서울특별시",
    city: "서울특별시",
    district: "마포구",
    street: "월드컵로 1",
    detail: "101호",
  },
  occupancyPolicyInfo: {
    maxOccupancy: "4",
    infantOccupancy: false,
    petOccupancy: false,
  },
  amenityInfos: [],
  ...overrides,
});

describe("useAccommodationEditSave", () => {
  const clearError = jest.fn();
  const handleError = jest.fn();
  const navigateToHostProfile = jest.fn();
  const setIsSaving = jest.fn();
  const updateAccommodation = jest.fn();
  const publishAccommodation = jest.fn();
  const commitPersistedFormData = jest.fn();
  const imageItems: AccommodationEditImageItem[] = [
    { id: 7, url: "/image.jpg", tempId: "existing-7" },
  ];

  beforeEach(() => {
    clearError.mockReset();
    handleError.mockReset();
    navigateToHostProfile.mockReset();
    setIsSaving.mockReset();
    updateAccommodation.mockReset();
    publishAccommodation.mockReset();
    commitPersistedFormData.mockReset();
    updateAccommodation.mockResolvedValue(undefined);
    publishAccommodation.mockResolvedValue(undefined);
  });

  it("skips PATCH and navigates when save-and-exit has no form or image changes", async () => {
    const formData = createFilledFormData();

    const { result } = renderHook(
      () =>
        useAccommodationEditSave({
          accommodationId: "3",
          currentStep: 2,
          isNewDraft: false,
          formData,
          initialFormData: formData,
          imageItems,
          initialImageItems: imageItems,
          clearError,
          handleError,
          setIsSaving,
          navigateToHostProfile,
          updateAccommodation,
          publishAccommodation,
        }),
      { wrapper: createWrapper().wrapper },
    );

    await act(async () => {
      await result.current.handleSaveAndExit();
    });

    expect(updateAccommodation).not.toHaveBeenCalled();
    expect(navigateToHostProfile).toHaveBeenCalled();
  });

  it("stays in the editor when save-and-exit preparation throws", async () => {
    const formData = createFilledFormData();
    const preparationError = new Error("prepare failed");
    const prepareImagesForPersistence = jest
      .fn<Promise<boolean>, []>()
      .mockRejectedValue(preparationError);

    const { result } = renderHook(
      () =>
        useAccommodationEditSave({
          accommodationId: "3",
          currentStep: 2,
          isNewDraft: false,
          formData,
          initialFormData: formData,
          imageItems,
          initialImageItems: imageItems,
          clearError,
          handleError,
          setIsSaving,
          navigateToHostProfile,
          prepareImagesForPersistence,
          updateAccommodation,
          publishAccommodation,
        }),
      { wrapper: createWrapper().wrapper },
    );

    await act(async () => {
      await result.current.handleSaveAndExit();
    });

    expect(handleError).toHaveBeenCalledWith(preparationError);
    expect(updateAccommodation).not.toHaveBeenCalled();
    expect(navigateToHostProfile).not.toHaveBeenCalled();
  });

  it("holds the saving lock for the whole save-and-exit preparation", async () => {
    const formData = createFilledFormData();
    let finishPreparation: (prepared: boolean) => void = () => undefined;
    const prepareImagesForPersistence = jest.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishPreparation = resolve;
        })
    );

    const { result } = renderHook(
      () =>
        useAccommodationEditSave({
          accommodationId: "3",
          currentStep: 2,
          isNewDraft: false,
          formData,
          initialFormData: formData,
          imageItems,
          initialImageItems: imageItems,
          clearError,
          handleError,
          setIsSaving,
          navigateToHostProfile,
          prepareImagesForPersistence,
          updateAccommodation,
          publishAccommodation,
        }),
      { wrapper: createWrapper().wrapper },
    );

    let savePromise: Promise<void>;
    act(() => {
      savePromise = result.current.handleSaveAndExit();
    });

    expect(setIsSaving).toHaveBeenCalledWith(true);
    expect(setIsSaving).not.toHaveBeenCalledWith(false);

    await act(async () => {
      finishPreparation(false);
      await savePromise!;
    });

    expect(setIsSaving.mock.calls).toEqual([[true], [false]]);
    expect(navigateToHostProfile).not.toHaveBeenCalled();
  });

  it("asks for detail address confirmation before running the pending save action", async () => {
    const formData = createFilledFormData({
      addressInfo: {
        ...createFilledFormData().addressInfo,
        detail: "",
      },
    });

    const { result } = renderHook(
      () =>
        useAccommodationEditSave({
          accommodationId: "3",
          currentStep: 1,
          isNewDraft: false,
          formData,
          initialFormData: formData,
          imageItems,
          initialImageItems: imageItems,
          clearError,
          handleError,
          setIsSaving,
          navigateToHostProfile,
          updateAccommodation,
          publishAccommodation,
        }),
      { wrapper: createWrapper().wrapper },
    );

    await act(async () => {
      await result.current.handleSaveAndExit();
    });

    expect(result.current.showDetailAddressConfirm).toBe(true);
    expect(navigateToHostProfile).not.toHaveBeenCalled();

    await act(async () => {
      result.current.confirmDetailAddress();
    });

    await waitFor(() => expect(navigateToHostProfile).toHaveBeenCalled());
  });

  it("publishes the accommodation through the injected API boundary", async () => {
    const formData = createFilledFormData();

    const { result } = renderHook(
      () =>
        useAccommodationEditSave({
          accommodationId: "3",
          currentStep: 5,
          isNewDraft: false,
          formData,
          initialFormData: formData,
          imageItems,
          initialImageItems: imageItems,
          clearError,
          handleError,
          setIsSaving,
          navigateToHostProfile,
          updateAccommodation,
          publishAccommodation,
        }),
      { wrapper: createWrapper().wrapper },
    );

    await act(async () => {
      await result.current.handlePublish({ preventDefault: jest.fn() });
    });

    expect(publishAccommodation).toHaveBeenCalledWith(3);
    expect(navigateToHostProfile).toHaveBeenCalled();
  });

  it("saves changed form data before publishing", async () => {
    const initialFormData = createFilledFormData();
    const formData = {
      ...initialFormData,
      name: "게시 직전 변경",
    };

    const { result } = renderHook(
      () =>
        useAccommodationEditSave({
          accommodationId: "3",
          currentStep: 5,
          isNewDraft: false,
          formData,
          initialFormData,
          imageItems,
          initialImageItems: imageItems,
          clearError,
          handleError,
          setIsSaving,
          navigateToHostProfile,
          updateAccommodation,
          publishAccommodation,
        }),
      { wrapper: createWrapper().wrapper },
    );

    await act(async () => {
      await result.current.handlePublish({ preventDefault: jest.fn() });
    });

    expect(updateAccommodation).toHaveBeenCalledWith(3, {
      name: "게시 직전 변경",
    });
    expect(publishAccommodation).toHaveBeenCalledWith(3);
    expect(updateAccommodation.mock.invocationCallOrder[0]).toBeLessThan(
      publishAccommodation.mock.invocationCallOrder[0]
    );
  });

  it("diffs a newly created draft against its hydrated server baseline", async () => {
    const initialFormData = createFilledFormData();
    const formData = {
      ...initialFormData,
      name: "서버 초안에서 변경한 이름",
    };

    const { result } = renderHook(
      () =>
        useAccommodationEditSave({
          accommodationId: "3",
          currentStep: 3,
          isNewDraft: true,
          formData,
          initialFormData,
          imageItems,
          initialImageItems: imageItems,
          clearError,
          handleError,
          setIsSaving,
          navigateToHostProfile,
          updateAccommodation,
          publishAccommodation,
        }),
      { wrapper: createWrapper().wrapper },
    );

    await act(async () => {
      await result.current.saveStepData();
    });

    expect(updateAccommodation).toHaveBeenCalledWith(3, {
      name: "서버 초안에서 변경한 이름",
    });
  });

  it("saves the current step data through the update boundary", async () => {
    const initialFormData = createFilledFormData();
    const formData = {
      ...initialFormData,
      name: "변경된 숙소",
    };

    const { result } = renderHook(
      () =>
        useAccommodationEditSave({
          accommodationId: "3",
          currentStep: 4,
          isNewDraft: false,
          formData,
          initialFormData,
          imageItems,
          initialImageItems: imageItems,
          clearError,
          handleError,
          setIsSaving,
          navigateToHostProfile,
          updateAccommodation,
          publishAccommodation,
        }),
      { wrapper: createWrapper().wrapper },
    );

    let saved = false;
    await act(async () => {
      saved = await result.current.saveStepData();
    });

    expect(saved).toBe(true);
    expect(updateAccommodation).toHaveBeenCalledWith(3, {
      name: "변경된 숙소",
    });
    expect(navigateToHostProfile).not.toHaveBeenCalled();
  });

  it("commits the exact form snapshot captured before an intermediate save awaits", async () => {
    const initialFormData = createFilledFormData();
    const submittedFormData = {
      ...initialFormData,
      name: "서버에 제출한 이름",
    };
    const laterFormData = {
      ...submittedFormData,
      name: "요청 대기 중 입력한 이름",
    };
    let resolveUpdate: () => void = () => undefined;
    updateAccommodation.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        })
    );

    const { result, rerender } = renderHook(
      ({ formData }) =>
        useAccommodationEditSave({
          accommodationId: "3",
          currentStep: 4,
          isNewDraft: false,
          formData,
          initialFormData,
          imageItems,
          initialImageItems: imageItems,
          clearError,
          handleError,
          setIsSaving,
          navigateToHostProfile,
          commitPersistedFormData,
          updateAccommodation,
          publishAccommodation,
        }),
      { initialProps: { formData: submittedFormData }, wrapper: createWrapper().wrapper }
    );

    let savePromise: Promise<boolean>;
    act(() => {
      savePromise = result.current.saveStepData();
    });
    rerender({ formData: laterFormData });

    await act(async () => {
      resolveUpdate();
      await savePromise!;
    });

    expect(commitPersistedFormData).toHaveBeenCalledWith(
      "3",
      submittedFormData,
      { name: "서버에 제출한 이름" }
    );
  });

  it("keeps the previous baseline when an intermediate save fails", async () => {
    const initialFormData = createFilledFormData();
    const formData = { ...initialFormData, name: "실패한 변경" };
    updateAccommodation.mockRejectedValueOnce(new Error("save failed"));

    const { result } = renderHook(
      () =>
        useAccommodationEditSave({
          accommodationId: "3",
          currentStep: 4,
          isNewDraft: false,
          formData,
          initialFormData,
          imageItems,
          initialImageItems: imageItems,
          clearError,
          handleError,
          setIsSaving,
          navigateToHostProfile,
          commitPersistedFormData,
          updateAccommodation,
          publishAccommodation,
        }),
      { wrapper: createWrapper().wrapper }
    );

    await act(async () => {
      await result.current.saveStepData();
    });

    expect(commitPersistedFormData).not.toHaveBeenCalled();
  });

  it("does not commit an old save after the route accommodation changes", async () => {
    const initialFormData = createFilledFormData();
    const formData = { ...initialFormData, name: "이전 숙소 변경" };
    let resolveUpdate: () => void = () => undefined;
    updateAccommodation.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        })
    );

    const { result, rerender } = renderHook(
      ({ accommodationId }) =>
        useAccommodationEditSave({
          accommodationId,
          currentStep: 4,
          isNewDraft: false,
          formData,
          initialFormData,
          imageItems,
          initialImageItems: imageItems,
          clearError,
          handleError,
          setIsSaving,
          navigateToHostProfile,
          commitPersistedFormData,
          updateAccommodation,
          publishAccommodation,
        }),
      { initialProps: { accommodationId: "3" }, wrapper: createWrapper().wrapper }
    );

    let savePromise: Promise<boolean>;
    act(() => {
      savePromise = result.current.saveStepData();
    });
    rerender({ accommodationId: "4" });

    await act(async () => {
      resolveUpdate();
      await savePromise!;
    });

    expect(commitPersistedFormData).not.toHaveBeenCalled();
  });

  it("does not surface an old save failure after the route accommodation changes", async () => {
    const initialFormData = createFilledFormData();
    const formData = { ...initialFormData, name: "이전 숙소 변경" };
    let rejectUpdate: (error: Error) => void = () => undefined;
    updateAccommodation.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectUpdate = reject;
        })
    );

    const { result, rerender } = renderHook(
      ({ accommodationId }) =>
        useAccommodationEditSave({
          accommodationId,
          currentStep: 4,
          isNewDraft: false,
          formData,
          initialFormData,
          imageItems,
          initialImageItems: imageItems,
          clearError,
          handleError,
          setIsSaving,
          navigateToHostProfile,
          commitPersistedFormData,
          updateAccommodation,
          publishAccommodation,
        }),
      {
        initialProps: { accommodationId: "3" },
        wrapper: createWrapper().wrapper,
      }
    );

    let savePromise: Promise<boolean>;
    act(() => {
      savePromise = result.current.saveStepData();
    });
    rerender({ accommodationId: "4" });

    await act(async () => {
      rejectUpdate(new Error("old save failed"));
      await savePromise!;
    });

    expect(handleError).not.toHaveBeenCalled();
  });

  it("does not commit or navigate after the editor unmounts during persistence", async () => {
    const initialFormData = createFilledFormData();
    const formData = { ...initialFormData, name: "언마운트 전 변경" };
    let resolveUpdate: () => void = () => undefined;
    updateAccommodation.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        })
    );

    const { result, unmount } = renderHook(
      () =>
        useAccommodationEditSave({
          accommodationId: "3",
          currentStep: 4,
          isNewDraft: false,
          formData,
          initialFormData,
          imageItems,
          initialImageItems: imageItems,
          clearError,
          handleError,
          setIsSaving,
          navigateToHostProfile,
          commitPersistedFormData,
          updateAccommodation,
          publishAccommodation,
        }),
      { wrapper: createWrapper().wrapper }
    );

    let savePromise: Promise<boolean>;
    act(() => {
      savePromise = result.current.saveStepData();
    });
    unmount();

    await act(async () => {
      resolveUpdate();
      await savePromise!;
    });

    expect(commitPersistedFormData).not.toHaveBeenCalled();
    expect(navigateToHostProfile).not.toHaveBeenCalled();
    expect(handleError).not.toHaveBeenCalled();
  });

  it("sends a reversal made after a successful step save before publishing", async () => {
    const serverInitialFormData = createFilledFormData();
    const stepSavedFormData = {
      ...serverInitialFormData,
      name: "단계에서 저장한 이름",
    };

    const { result, rerender } = renderHook(
      ({ currentFormData }) => {
        const [persistedFormData, setPersistedFormData] = React.useState(
          serverInitialFormData
        );
        const editSave = useAccommodationEditSave({
          accommodationId: "3",
          currentStep: 5,
          isNewDraft: false,
          formData: currentFormData,
          initialFormData: persistedFormData,
          imageItems,
          initialImageItems: imageItems,
          clearError,
          handleError,
          setIsSaving,
          navigateToHostProfile,
          commitPersistedFormData: (_accommodationId, snapshot) => {
            setPersistedFormData(snapshot);
          },
          updateAccommodation,
          publishAccommodation,
        });

        return { editSave, persistedFormData };
      },
      {
        initialProps: { currentFormData: stepSavedFormData },
        wrapper: createWrapper().wrapper,
      }
    );

    await act(async () => {
      await result.current.editSave.saveStepData();
    });
    expect(result.current.persistedFormData.name).toBe("단계에서 저장한 이름");

    rerender({ currentFormData: serverInitialFormData });

    await act(async () => {
      await result.current.editSave.handlePublish({
        preventDefault: jest.fn(),
      });
    });

    expect(updateAccommodation.mock.calls).toEqual([
      [3, { name: "단계에서 저장한 이름" }],
      [3, { name: "기존 숙소" }],
    ]);
    expect(publishAccommodation).toHaveBeenCalledWith(3);
  });

  it("invalidates accommodation detail and host listing caches after saving changes", async () => {
    const initialFormData = createFilledFormData();
    const formData = {
      ...initialFormData,
      name: "변경된 숙소",
    };
    const { queryClient, wrapper } = createWrapper();
    const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(
      () =>
        useAccommodationEditSave({
          accommodationId: "3",
          currentStep: 4,
          isNewDraft: false,
          formData,
          initialFormData,
          imageItems,
          initialImageItems: imageItems,
          clearError,
          handleError,
          setIsSaving,
          navigateToHostProfile,
          updateAccommodation,
          publishAccommodation,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.saveStepData();
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: accommodationQueryKeys.detailRoot,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: profileQueryKeys.hostListingsRoot,
    });
  });

  it("invalidates caches when save-and-exit changes only images", async () => {
    const formData = createFilledFormData();
    const currentImageItems: AccommodationEditImageItem[] = [
      ...imageItems,
      { id: 8, url: "/uploaded.jpg", tempId: "uploaded-8" },
    ];
    const { queryClient, wrapper } = createWrapper();
    const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(
      () =>
        useAccommodationEditSave({
          accommodationId: "3",
          currentStep: 2,
          isNewDraft: false,
          formData,
          initialFormData: formData,
          imageItems: currentImageItems,
          initialImageItems: imageItems,
          clearError,
          handleError,
          setIsSaving,
          navigateToHostProfile,
          updateAccommodation,
          publishAccommodation,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleSaveAndExit();
    });

    expect(updateAccommodation).not.toHaveBeenCalled();
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: accommodationQueryKeys.detailRoot,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: profileQueryKeys.hostListingsRoot,
    });
    expect(navigateToHostProfile).toHaveBeenCalledTimes(1);
  });

  it("invalidates changed accommodation caches when publish fails after a successful update", async () => {
    const initialFormData = createFilledFormData();
    const formData = {
      ...initialFormData,
      name: "게시 실패 전 저장된 변경",
    };
    const publishError = new Error("publish failed");
    publishAccommodation.mockRejectedValueOnce(publishError);
    const { queryClient, wrapper } = createWrapper();
    const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(
      () =>
        useAccommodationEditSave({
          accommodationId: "3",
          currentStep: 5,
          isNewDraft: false,
          formData,
          initialFormData,
          imageItems,
          initialImageItems: imageItems,
          clearError,
          handleError,
          setIsSaving,
          navigateToHostProfile,
          updateAccommodation,
          publishAccommodation,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.handlePublish({ preventDefault: jest.fn() });
    });

    expect(updateAccommodation).toHaveBeenCalledWith(3, {
      name: "게시 실패 전 저장된 변경",
    });
    expect(publishAccommodation).toHaveBeenCalledWith(3);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: accommodationQueryKeys.detailRoot,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: profileQueryKeys.hostListingsRoot,
    });
    expect(handleError).toHaveBeenCalledWith(publishError);
    expect(navigateToHostProfile).not.toHaveBeenCalled();
  });

  it("invalidates uploaded image caches when publish fails without a form diff", async () => {
    const formData = createFilledFormData();
    const publishError = new Error("publish failed");
    const prepareImagesForPersistence = jest.fn().mockResolvedValue(true);
    const hasPendingImageChanges = jest.fn().mockReturnValue(true);
    publishAccommodation.mockRejectedValueOnce(publishError);
    const { queryClient, wrapper } = createWrapper();
    const invalidateQueriesSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(
      () =>
        useAccommodationEditSave({
          accommodationId: "3",
          currentStep: 5,
          isNewDraft: false,
          formData,
          initialFormData: formData,
          imageItems,
          initialImageItems: imageItems,
          clearError,
          handleError,
          setIsSaving,
          navigateToHostProfile,
          prepareImagesForPersistence,
          hasPendingImageChanges,
          updateAccommodation,
          publishAccommodation,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.handlePublish({ preventDefault: jest.fn() });
    });

    expect(prepareImagesForPersistence).toHaveBeenCalledTimes(1);
    expect(updateAccommodation).not.toHaveBeenCalled();
    expect(publishAccommodation).toHaveBeenCalledWith(3);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: accommodationQueryKeys.detailRoot,
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: profileQueryKeys.hostListingsRoot,
    });
    expect(handleError).toHaveBeenCalledWith(publishError);
    expect(navigateToHostProfile).not.toHaveBeenCalled();
  });
});
