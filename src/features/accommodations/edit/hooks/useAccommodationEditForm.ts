import { useCallback, useState } from "react";
import { HostAccommodationDetail } from "../../../../types/accommodation";
import {
  AccommodationEditFormData,
  createDefaultAccommodationEditFormData,
  mapHostAccommodationToEditFormData,
} from "../lib/accommodationEditMapper";
import { formatTime } from "../lib/time";

export type AccommodationEditStep = 1 | 2 | 3 | 4 | 5;

interface StepCompletionOptions {
  imageCount: number;
  isNewDraft: boolean;
}

type NestedFormFields = {
  addressInfo: AccommodationEditFormData["addressInfo"];
  occupancyPolicyInfo: AccommodationEditFormData["occupancyPolicyInfo"];
};

const cloneFormData = (formData: AccommodationEditFormData) =>
  JSON.parse(JSON.stringify(formData)) as AccommodationEditFormData;

export const useAccommodationEditForm = () => {
  const [formData, setFormData] = useState(() =>
    createDefaultAccommodationEditFormData()
  );
  const [initialFormData, setInitialFormData] =
    useState<AccommodationEditFormData | null>(null);
  const [selectedAmenities, setSelectedAmenities] = useState<Set<string>>(
    new Set()
  );
  const [openTimePicker, setOpenTimePicker] = useState<
    "checkIn" | "checkOut" | null
  >(null);

  const loadAccommodation = useCallback((data: HostAccommodationDetail) => {
    const loadedFormData = mapHostAccommodationToEditFormData(data);
    setFormData(loadedFormData);
    setInitialFormData(cloneFormData(loadedFormData));
    setSelectedAmenities(new Set(data.amenities?.map((amenity) => amenity.type) || []));
    return loadedFormData;
  }, []);

  const handleInputChange = useCallback(
    <K extends keyof AccommodationEditFormData>(
      field: K,
      value: AccommodationEditFormData[K]
    ) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const handleNestedChange = useCallback(
    <
      P extends keyof NestedFormFields,
      K extends keyof NestedFormFields[P]
    >(
      parent: P,
      field: K,
      value: NestedFormFields[P][K]
    ) => {
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [field]: value,
        },
      }));
    },
    []
  );

  const handleTimeChange = useCallback(
    (
      type: "checkIn" | "checkOut",
      hour: number,
      minute: number,
      period: "AM" | "PM"
    ) => {
      const timeString = formatTime(hour, minute, period);
      handleInputChange(
        type === "checkIn" ? "checkInTime" : "checkOutTime",
        timeString
      );
    },
    [handleInputChange]
  );

  const isStepCompleted = useCallback(
    (
      step: AccommodationEditStep,
      { imageCount, isNewDraft }: StepCompletionOptions
    ): boolean => {
      const isLocationCompleted = Boolean(
        formData.addressInfo.street && formData.addressInfo.street.trim() !== ""
      );
      const isPhotoCompleted = imageCount >= 1;
      const isInfoCompleted = Boolean(
        formData.name &&
          formData.description &&
          formData.basePrice &&
          formData.type &&
          formData.occupancyPolicyInfo.maxOccupancy
      );
      const isTimeCompleted = Boolean(
        formData.checkInTime && formData.checkOutTime
      );
      const isDraftTimeCompleted = isNewDraft
        ? isLocationCompleted && isPhotoCompleted && isInfoCompleted && isTimeCompleted
        : isTimeCompleted;

      switch (step) {
        case 1:
          return isLocationCompleted;
        case 2:
          return isPhotoCompleted;
        case 3:
          return isInfoCompleted;
        case 4:
          return isDraftTimeCompleted;
        case 5:
          return (
            isLocationCompleted &&
            isPhotoCompleted &&
            isInfoCompleted &&
            isDraftTimeCompleted
          );
        default:
          return false;
      }
    },
    [formData]
  );

  const canProceedToNext = useCallback(
    (
      currentStep: AccommodationEditStep,
      options: StepCompletionOptions
    ): boolean => isStepCompleted(currentStep, options),
    [isStepCompleted]
  );

  return {
    formData,
    setFormData,
    initialFormData,
    setInitialFormData,
    selectedAmenities,
    setSelectedAmenities,
    openTimePicker,
    setOpenTimePicker,
    loadAccommodation,
    handleInputChange,
    handleNestedChange,
    handleTimeChange,
    isStepCompleted,
    canProceedToNext,
  };
};
