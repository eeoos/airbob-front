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
});
