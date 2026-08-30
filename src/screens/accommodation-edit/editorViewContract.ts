import type {
  ChangeEvent,
  Dispatch,
  DragEvent,
  FormEvent,
  SetStateAction,
} from "react";

export type AccommodationEditStep = 1 | 2 | 3 | 4 | 5;
export type AccommodationEditTimeField = "checkIn" | "checkOut";
export type AccommodationEditTimePicker = AccommodationEditTimeField | null;
export type AccommodationEditTimePeriod = "AM" | "PM";
export type AccommodationEditRecoveryState =
  | "none"
  | "protected-command"
  | "protected-delete";

export interface AccommodationEditAmenityInfo {
  name: string;
  count: number;
}

export interface AccommodationEditFormData {
  name: string;
  description: string;
  basePrice: string;
  type: string;
  checkInTime: string;
  checkOutTime: string;
  addressInfo: {
    postalCode: string;
    city: string;
    state: string;
    country: string;
    detail: string;
    district: string;
    street: string;
  };
  occupancyPolicyInfo: {
    maxOccupancy: string;
    infantOccupancy: boolean;
    petOccupancy: boolean;
  };
  amenityInfos: AccommodationEditAmenityInfo[];
}

export interface AccommodationEditImageItem {
  clientId: string;
  id?: number;
  url: string;
  file?: File;
  preview?: string;
}

export type AccommodationEditDetailState =
  | { status: "loading"; accommodationId: string }
  | { status: "ready"; accommodationId: string }
  | { status: "invalid-resource"; accommodationId: string }
  | { status: "denied"; accommodationId: string }
  | { status: "retryable-load-error"; accommodationId: string };

type NestedFormFields = {
  addressInfo: AccommodationEditFormData["addressInfo"];
  occupancyPolicyInfo: AccommodationEditFormData["occupancyPolicyInfo"];
};

export interface AccommodationEditScreenState {
  currentStep: AccommodationEditStep;
  detailState: AccommodationEditDetailState;
  isEditorReady: boolean;
  isSaving: boolean;
  isDeletingImage: boolean;
  recoveryState: AccommodationEditRecoveryState;
  uploadProgress: number;
  formData: AccommodationEditFormData;
  imageItems: AccommodationEditImageItem[];
  draggedIndex: number | null;
  dragOverIndex: number | null;
  openTimePicker: AccommodationEditTimePicker;
  isTypeModalOpen: boolean;
  isAmenityModalOpen: boolean;
  showDetailAddressConfirm: boolean;
  error: string | null;
  canProceedToNext: boolean;
}

export interface AccommodationEditScreenActions {
  isStepCompleted: (step: AccommodationEditStep) => boolean;
  isStepClickable: (step: AccommodationEditStep) => boolean;
  setFormData: Dispatch<SetStateAction<AccommodationEditFormData>>;
  setOpenTimePicker: Dispatch<SetStateAction<AccommodationEditTimePicker>>;
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
  onInputChange: <K extends keyof AccommodationEditFormData>(
    field: K,
    value: AccommodationEditFormData[K]
  ) => void;
  onNestedChange: <
    P extends keyof NestedFormFields,
    K extends keyof NestedFormFields[P],
  >(
    parent: P,
    field: K,
    value: NestedFormFields[P][K]
  ) => void;
  onTimeChange: (
    type: AccommodationEditTimeField,
    hour: number,
    minute: number,
    period: AccommodationEditTimePeriod
  ) => void;
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
