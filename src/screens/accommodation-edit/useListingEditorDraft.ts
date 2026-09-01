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
import {
  formatListingEditorTime,
  parseListingEditorTime,
} from "../../features/accommodations/listing-editor/model/listingEditorTime";
import type {
  AccommodationEditField,
  AccommodationEditFormData,
  AccommodationEditOccupancyField,
  AccommodationEditTimeField,
  AccommodationEditTimePicker,
  AccommodationEditTimeValueSelection,
} from "./editorViewContract";
import { ACCOMMODATION_TYPE_OPTIONS } from "./components/editorOptions";

const toEditorFormData = (
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

const createDefaultFormData = (): AccommodationEditFormData => {
  const form = createDefaultListingEditorFormData();
  return {
    ...form,
    addressInfo: { ...form.addressInfo },
    occupancyPolicyInfo: { ...form.occupancyPolicyInfo },
    amenityInfos: [],
  };
};

const isValidAmenityName = (name: string): boolean => name.trim().length > 0;

const toPositiveGuestCount = (value: string): number | null => {
  const count = Number(value);
  return Number.isSafeInteger(count) && count > 0 ? count : null;
};

const isValidTimeSelection = (
  selection: AccommodationEditTimeValueSelection,
): boolean => {
  switch (selection.unit) {
    case "hour":
      return (
        Number.isInteger(selection.value) &&
        selection.value >= 1 &&
        selection.value <= 12
      );
    case "minute":
      return (
        Number.isInteger(selection.value) &&
        selection.value >= 0 &&
        selection.value <= 59
      );
    case "period":
      return selection.value === "AM" || selection.value === "PM";
    default:
      return false;
  }
};

export const useListingEditorDraft = () => {
  const [formData, setFormData] = useState<AccommodationEditFormData>(
    createDefaultFormData,
  );
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
    const form = toEditorFormData(accommodation);
    setFormData(form);
    setBaseline(cloneListingEditorFormData(form));
    setFallbackProvenance(getListingEditorFallbackProvenance(accommodation));
    setOpenTimePicker(null);
  }, []);

  const commitBaseline = useCallback(
    (accommodation: ListingEditorAccommodation) => {
      setBaseline(toEditorFormData(accommodation));
      setFallbackProvenance(getListingEditorFallbackProvenance(accommodation));
    },
    [],
  );

  const capturePersistence = useCallback(() => {
    if (!baseline) return null;
    const submittedForm = cloneListingEditorFormData(formData);
    return {
      update: buildListingEditorUpdate({
        formData: submittedForm,
        baseline,
        fallbackProvenance,
      }),
    };
  }, [baseline, fallbackProvenance, formData]);

  const changeField = useCallback(
    (field: AccommodationEditField, value: string) => {
      if (
        typeof value !== "string" ||
        (field !== "name" && field !== "description" && field !== "basePrice")
      ) {
        return;
      }
      setFormData((current) => ({ ...current, [field]: value }));
    },
    [],
  );

  const replaceAddress = useCallback(
    (address: AccommodationEditFormData["addressInfo"]) => {
      setFormData((current) => ({
        ...current,
        addressInfo: { ...address },
      }));
    },
    [],
  );

  const changeAddressDetail = useCallback((value: string) => {
    if (typeof value !== "string") return;
    setFormData((current) => ({
      ...current,
      addressInfo: { ...current.addressInfo, detail: value },
    }));
  }, []);

  const changeOccupancy = useCallback(
    (field: AccommodationEditOccupancyField, value: boolean) => {
      if (
        typeof value !== "boolean" ||
        (field !== "infantOccupancy" && field !== "petOccupancy")
      ) {
        return;
      }
      setFormData((current) => ({
        ...current,
        occupancyPolicyInfo: {
          ...current.occupancyPolicyInfo,
          [field]: value,
        },
      }));
    },
    [],
  );

  const changeGuestBy = useCallback((delta: -1 | 1) => {
    setFormData((current) => {
      const count = toPositiveGuestCount(
        current.occupancyPolicyInfo.maxOccupancy,
      );
      if (count === null) return current;
      const nextCount = count + delta;
      if (!Number.isSafeInteger(nextCount) || nextCount < 1) return current;
      return {
        ...current,
        occupancyPolicyInfo: {
          ...current.occupancyPolicyInfo,
          maxOccupancy: String(nextCount),
        },
      };
    });
  }, []);

  const incrementGuest = useCallback(() => changeGuestBy(1), [changeGuestBy]);
  const decrementGuest = useCallback(() => changeGuestBy(-1), [changeGuestBy]);

  const selectAccommodationType = useCallback((type: string) => {
    if (!ACCOMMODATION_TYPE_OPTIONS.some((option) => option.value === type)) {
      return false;
    }
    setFormData((current) => ({ ...current, type }));
    return true;
  }, []);

  const toggleAmenity = useCallback((name: string) => {
    if (!isValidAmenityName(name)) return;
    setFormData((current) => {
      const isSelected = current.amenityInfos.some(
        (amenity) => amenity.name === name,
      );
      return {
        ...current,
        amenityInfos: isSelected
          ? current.amenityInfos.filter((amenity) => amenity.name !== name)
          : [...current.amenityInfos, { name, count: 1 }],
      };
    });
  }, []);

  const changeAmenityBy = useCallback((name: string, delta: -1 | 1) => {
    if (!isValidAmenityName(name)) return;
    setFormData((current) => {
      const matchingAmenities = current.amenityInfos.filter(
        (amenity) => amenity.name === name,
      );
      if (
        matchingAmenities.length === 0 ||
        matchingAmenities.some(
          (amenity) =>
            !Number.isSafeInteger(amenity.count) ||
            !Number.isSafeInteger(amenity.count + delta) ||
            amenity.count + delta < 1,
        )
      ) {
        return current;
      }
      return {
        ...current,
        amenityInfos: current.amenityInfos.map((amenity) =>
          amenity.name === name
            ? { ...amenity, count: amenity.count + delta }
            : amenity,
        ),
      };
    });
  }, []);

  const incrementAmenity = useCallback(
    (name: string) => changeAmenityBy(name, 1),
    [changeAmenityBy],
  );
  const decrementAmenity = useCallback(
    (name: string) => changeAmenityBy(name, -1),
    [changeAmenityBy],
  );

  const removeAmenity = useCallback((name: string) => {
    if (!isValidAmenityName(name)) return;
    setFormData((current) => {
      if (!current.amenityInfos.some((amenity) => amenity.name === name)) {
        return current;
      }
      return {
        ...current,
        amenityInfos: current.amenityInfos.filter(
          (amenity) => amenity.name !== name,
        ),
      };
    });
  }, []);

  const openTimePickerCommand = useCallback(
    (picker: AccommodationEditTimeField) => {
      if (picker !== "checkIn" && picker !== "checkOut") return;
      setOpenTimePicker(picker);
    },
    [],
  );

  const closeTimePicker = useCallback(() => {
    setOpenTimePicker(null);
  }, []);

  const selectTimeValue = useCallback(
    (
      type: AccommodationEditTimeField,
      selection: AccommodationEditTimeValueSelection,
    ) => {
      if (
        (type !== "checkIn" && type !== "checkOut") ||
        !isValidTimeSelection(selection)
      ) {
        return;
      }
      const field = type === "checkIn" ? "checkInTime" : "checkOutTime";
      setFormData((current) => {
        const time = parseListingEditorTime(current[field]);
        const value = formatListingEditorTime(
          selection.unit === "hour" ? selection.value : time.hour,
          selection.unit === "minute" ? selection.value : time.minute,
          selection.unit === "period" ? selection.value : time.period,
        );
        return value === current[field]
          ? current
          : { ...current, [field]: value };
      });
    },
    [],
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
    changeAddressDetail,
    changeField,
    changeOccupancy,
    closeTimePicker,
    commitBaseline,
    decrementAmenity,
    decrementGuest,
    formData,
    hydrate,
    incrementAmenity,
    incrementGuest,
    isStepCompleted,
    openTimePicker,
    openTimePickerCommand,
    removeAmenity,
    replaceAddress,
    selectAccommodationType,
    selectTimeValue,
    toggleAmenity,
  };
};
