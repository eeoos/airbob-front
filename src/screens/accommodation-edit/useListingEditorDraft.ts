import { useCallback, useState } from "react";
import type { ListingEditorAccommodation } from "../../features/accommodations/listing-editor/model/listingEditor";
import {
  buildListingEditorUpdate,
  cloneListingEditorFormData,
  createDefaultListingEditorFormData,
  getListingEditorFallbackProvenance,
  isListingEditorStepCompleted,
  toListingEditorFormData,
  type ListingEditorFallbackProvenance,
  type ListingEditorStep,
} from "../../features/accommodations/listing-editor/model/listingEditorDraft";
import { formatListingEditorTime } from "../../features/accommodations/listing-editor/model/listingEditorTime";
import type {
  AccommodationEditFormData,
  AccommodationEditTimePicker,
  AccommodationEditTimePeriod,
} from "./editorViewContract";

type NestedFormFields = {
  addressInfo: AccommodationEditFormData["addressInfo"];
  occupancyPolicyInfo: AccommodationEditFormData["occupancyPolicyInfo"];
};

const toMutableForm = (
  accommodation: ListingEditorAccommodation,
): AccommodationEditFormData => {
  const form = toListingEditorFormData(accommodation);
  return {
    ...form,
    addressInfo: { ...form.addressInfo },
    occupancyPolicyInfo: { ...form.occupancyPolicyInfo },
    amenityInfos: form.amenityInfos.map((amenity) => ({ ...amenity })),
  };
};

const createMutableDefault = (): AccommodationEditFormData => {
  const form = createDefaultListingEditorFormData();
  return {
    ...form,
    addressInfo: { ...form.addressInfo },
    occupancyPolicyInfo: { ...form.occupancyPolicyInfo },
    amenityInfos: [],
  };
};

export const useListingEditorDraft = () => {
  const [formData, setFormData] =
    useState<AccommodationEditFormData>(createMutableDefault);
  const [baseline, setBaseline] = useState<AccommodationEditFormData | null>(
    null,
  );
  const [fallbackProvenance, setFallbackProvenance] =
    useState<ListingEditorFallbackProvenance>({
      checkInTime: false,
      checkOutTime: false,
      occupancyPolicy: false,
    });
  const [openTimePicker, setOpenTimePicker] =
    useState<AccommodationEditTimePicker>(null);

  const hydrate = useCallback((accommodation: ListingEditorAccommodation) => {
    const form = toMutableForm(accommodation);
    setFormData(form);
    setBaseline(cloneListingEditorFormData(form) as AccommodationEditFormData);
    setFallbackProvenance(getListingEditorFallbackProvenance(accommodation));
    setOpenTimePicker(null);
  }, []);

  const commitBaseline = useCallback(
    (accommodation: ListingEditorAccommodation) => {
      setBaseline(toMutableForm(accommodation));
      setFallbackProvenance(getListingEditorFallbackProvenance(accommodation));
    },
    [],
  );

  const capturePersistence = useCallback(() => {
    if (!baseline) return null;
    const submittedForm = cloneListingEditorFormData(
      formData,
    ) as AccommodationEditFormData;
    return {
      update: buildListingEditorUpdate({
        formData: submittedForm,
        baseline,
        fallbackProvenance,
      }),
    };
  }, [baseline, fallbackProvenance, formData]);

  const handleInputChange = useCallback(
    <Key extends keyof AccommodationEditFormData>(
      field: Key,
      value: AccommodationEditFormData[Key],
    ) => {
      setFormData((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const handleNestedChange = useCallback(
    <
      Parent extends keyof NestedFormFields,
      Key extends keyof NestedFormFields[Parent],
    >(
      parent: Parent,
      field: Key,
      value: NestedFormFields[Parent][Key],
    ) => {
      setFormData((current) => ({
        ...current,
        [parent]: { ...current[parent], [field]: value },
      }));
    },
    [],
  );

  const handleTimeChange = useCallback(
    (
      type: Exclude<AccommodationEditTimePicker, null>,
      hour: number,
      minute: number,
      period: AccommodationEditTimePeriod,
    ) => {
      handleInputChange(
        type === "checkIn" ? "checkInTime" : "checkOutTime",
        formatListingEditorTime(hour, minute, period),
      );
    },
    [handleInputChange],
  );

  const isStepCompleted = useCallback(
    (
      step: ListingEditorStep,
      options: { readonly imageCount: number; readonly isNewDraft: boolean },
    ) => isListingEditorStepCompleted(formData, step, options),
    [formData],
  );

  return {
    baseline,
    capturePersistence,
    commitBaseline,
    formData,
    handleInputChange,
    handleNestedChange,
    handleTimeChange,
    hydrate,
    isStepCompleted,
    openTimePicker,
    setFormData,
    setOpenTimePicker,
  };
};
