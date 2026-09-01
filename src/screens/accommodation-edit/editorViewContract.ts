import type { ChangeEvent, DragEvent, FormEvent } from "react";

export type AccommodationEditStep = 1 | 2 | 3 | 4 | 5;
export type AccommodationEditTimeField = "checkIn" | "checkOut";
export type AccommodationEditTimePicker = AccommodationEditTimeField | null;
export type AccommodationEditTimePeriod = "AM" | "PM";
export type AccommodationEditTimeValueSelection =
  | { readonly unit: "hour"; readonly value: number }
  | { readonly unit: "minute"; readonly value: number }
  | { readonly unit: "period"; readonly value: AccommodationEditTimePeriod };
export type AccommodationEditRecoveryState =
  "none" | "protected-command" | "protected-delete";

interface AccommodationEditAmenityInfo {
  readonly name: string;
  readonly count: number;
}

export interface AccommodationEditAmenityOption {
  readonly label: string;
  readonly name: string;
}

export interface AccommodationEditAmenitySemantic extends AccommodationEditAmenityOption {
  readonly isKnown: boolean;
}

export interface AccommodationEditFormData {
  readonly name: string;
  readonly description: string;
  readonly basePrice: string;
  readonly type: string;
  readonly checkInTime: string;
  readonly checkOutTime: string;
  readonly addressInfo: {
    readonly postalCode: string;
    readonly city: string;
    readonly state: string;
    readonly country: string;
    readonly detail: string;
    readonly district: string;
    readonly street: string;
  };
  readonly occupancyPolicyInfo: {
    readonly maxOccupancy: string;
    readonly infantOccupancy: boolean;
    readonly petOccupancy: boolean;
  };
  readonly amenityInfos: readonly AccommodationEditAmenityInfo[];
}

export type AccommodationEditField = "name" | "description" | "basePrice";
export type AccommodationEditOccupancyField =
  "infantOccupancy" | "petOccupancy";

export interface AccommodationEditImageItem {
  readonly clientId: string;
  readonly id?: number;
  readonly url: string;
  readonly file?: File;
  readonly preview?: string;
}

export type AccommodationEditDetailState =
  | { status: "loading"; accommodationId: string }
  | { status: "ready"; accommodationId: string }
  | { status: "invalid-resource"; accommodationId: string }
  | { status: "denied"; accommodationId: string }
  | { status: "retryable-load-error"; accommodationId: string };

export interface AccommodationEditScreenState {
  readonly amenityOptions: readonly AccommodationEditAmenityOption[];
  readonly amenitySemantics: readonly AccommodationEditAmenitySemantic[];
  readonly currentStep: AccommodationEditStep;
  readonly detailState: AccommodationEditDetailState;
  readonly isEditorReady: boolean;
  readonly isSaving: boolean;
  readonly isDeletingImage: boolean;
  readonly recoveryState: AccommodationEditRecoveryState;
  readonly uploadProgress: number;
  readonly formData: AccommodationEditFormData;
  readonly imageItems: readonly AccommodationEditImageItem[];
  readonly draggedIndex: number | null;
  readonly dragOverIndex: number | null;
  readonly openTimePicker: AccommodationEditTimePicker;
  readonly isTypeModalOpen: boolean;
  readonly isAmenityModalOpen: boolean;
  readonly showDetailAddressConfirm: boolean;
  readonly error: string | null;
  readonly canProceedToNext: boolean;
}

export interface AccommodationEditScreenActions {
  isStepCompleted: (step: AccommodationEditStep) => boolean;
  isStepClickable: (step: AccommodationEditStep) => boolean;
  resolveImageUrl: (imagePath: string | null | undefined) => string;
  onAddressSearch: () => void;
  onDetailChange: (value: string) => void;
  onImageSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onImageRemove: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragOverItem: (event: DragEvent, index: number) => void;
  onDragEnd: (event: DragEvent) => void;
  onFieldChange: (field: AccommodationEditField, value: string) => void;
  onOccupancyChange: (
    field: AccommodationEditOccupancyField,
    value: boolean,
  ) => void;
  onGuestIncrement: () => void;
  onGuestDecrement: () => void;
  onAmenityToggle: (name: string) => void;
  onAmenityIncrement: (name: string) => void;
  onAmenityDecrement: (name: string) => void;
  onAmenityRemove: (name: string) => void;
  onTimePickerOpen: (picker: AccommodationEditTimeField) => void;
  onTimePickerClose: () => void;
  onTimeValueSelect: (
    type: AccommodationEditTimeField,
    selection: AccommodationEditTimeValueSelection,
  ) => void;
  onAccommodationTypeSelect: (type: string) => void;
  onOpenTypeModal: () => void;
  onCloseTypeModal: () => void;
  onOpenAmenityModal: () => void;
  onCloseAmenityModal: () => void;
  onSaveAndExit: () => void;
  onNext: () => void | Promise<void>;
  onBack: () => void;
  onStepClick: (stepNumber: AccommodationEditStep) => void;
  onPublishSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onCloseDetailAddressConfirm: () => void;
  onConfirmDetailAddress: () => void;
  onRetryDetail: () => void;
  onRetryRecovery: () => void;
  onExitDetailError: () => void;
  onClearError: () => void;
}

export interface AccommodationEditScreenProps {
  state: AccommodationEditScreenState;
  actions: AccommodationEditScreenActions;
}
