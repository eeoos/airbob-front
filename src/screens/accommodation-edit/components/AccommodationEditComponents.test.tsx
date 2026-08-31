import * as fs from "fs";
import * as path from "path";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OverlayProvider } from "../../../app/overlays/OverlayProvider";
import { AccommodationEditScreen } from "../AccommodationEditScreen";
import type {
  AccommodationEditFormData,
  AccommodationEditScreenActions,
  AccommodationEditScreenState,
} from "../editorViewContract";
import { AccommodationTypeModal } from "./AccommodationTypeModal";
import { AmenityModal } from "./AmenityModal";
import { DetailAddressConfirmModal } from "./DetailAddressConfirmModal";
import { InfoStep } from "./InfoStep";
import { PhotosStep } from "./PhotosStep";
import { PublishStep } from "./PublishStep";
import { TimePicker } from "./TimePicker";
import { TimeStep } from "./TimeStep";

const createFormData = (
  overrides: Partial<AccommodationEditFormData> = {},
): AccommodationEditFormData => ({
  name: "기존 숙소",
  description: "기존 설명",
  basePrice: "120000",
  type: "ENTIRE_PLACE",
  checkInTime: "15:00",
  checkOutTime: "11:00",
  addressInfo: {
    postalCode: "",
    city: "",
    state: "",
    country: "대한민국",
    detail: "",
    district: "",
    street: "",
  },
  occupancyPolicyInfo: {
    maxOccupancy: "1",
    infantOccupancy: false,
    petOccupancy: false,
  },
  amenityInfos: [{ name: "WIFI", count: 1 }],
  ...overrides,
});

const createScreenState = (
  overrides: Partial<AccommodationEditScreenState> = {},
): AccommodationEditScreenState => ({
  currentStep: 2,
  detailState: { status: "ready", accommodationId: "3" },
  isEditorReady: true,
  isSaving: false,
  isDeletingImage: false,
  recoveryState: "none",
  uploadProgress: 0,
  formData: createFormData(),
  imageItems: [],
  draggedIndex: null,
  dragOverIndex: null,
  openTimePicker: null,
  isTypeModalOpen: false,
  isAmenityModalOpen: false,
  showDetailAddressConfirm: false,
  error: null,
  canProceedToNext: true,
  ...overrides,
});

const createScreenActions = (
  overrides: Partial<AccommodationEditScreenActions> = {},
): AccommodationEditScreenActions => ({
  isStepCompleted: (step) => step < 2,
  isStepClickable: (step) => step <= 2,
  setFormData: vi.fn(),
  setOpenTimePicker: vi.fn(),
  resolveImageUrl: (imagePath) => imagePath || "",
  onAddressSearch: vi.fn(),
  onDetailChange: vi.fn(),
  onImageSelect: vi.fn(),
  onDrop: vi.fn(),
  onDragOver: vi.fn(),
  onImageRemove: vi.fn(),
  onDragStart: vi.fn(),
  onDragOverItem: vi.fn(),
  onDragEnd: vi.fn(),
  onInputChange: vi.fn(),
  onNestedChange: vi.fn(),
  onTimeChange: vi.fn(),
  onOpenTypeModal: vi.fn(),
  onCloseTypeModal: vi.fn(),
  onOpenAmenityModal: vi.fn(),
  onCloseAmenityModal: vi.fn(),
  onSaveAndExit: vi.fn(),
  onNext: vi.fn(),
  onBack: vi.fn(),
  onStepClick: vi.fn(),
  onPublishSubmit: vi.fn(),
  onCloseDetailAddressConfirm: vi.fn(),
  onConfirmDetailAddress: vi.fn(),
  onRetryDetail: vi.fn(),
  onRetryRecovery: vi.fn(),
  onExitDetailError: vi.fn(),
  onClearError: vi.fn(),
  ...overrides,
});

const readProjectFile = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const FEATURE_COMPONENTS_DIR = "src/screens/accommodation-edit/components";
const SCREEN_ROOT_DIR = "src/screens/accommodation-edit";

const getCssBlocks = (source: string, selector: string) => {
  const blocks: string[] = [];
  let searchStart = 0;

  while (searchStart < source.length) {
    const selectorStart = source.indexOf(selector, searchStart);
    if (selectorStart === -1) {
      break;
    }

    const blockStart = source.indexOf("{", selectorStart);
    if (blockStart === -1) {
      break;
    }

    let depth = 0;
    let foundBlockEnd = false;
    for (let index = blockStart; index < source.length; index += 1) {
      if (source[index] === "{") {
        depth += 1;
      }
      if (source[index] === "}") {
        depth -= 1;
      }
      if (depth === 0) {
        blocks.push(source.slice(blockStart + 1, index));
        searchStart = index + 1;
        foundBlockEnd = true;
        break;
      }
    }

    if (!foundBlockEnd) {
      break;
    }
  }

  return blocks;
};

describe("AccommodationEdit extracted components", () => {
  it("keeps edit UI components owned by the accommodation edit screen", () => {
    const featureComponentFiles = [
      "AccommodationTypeModal.tsx",
      "AmenityModal.tsx",
      "DetailAddressConfirmModal.tsx",
      "EditForm.module.css",
      "EditModal.module.css",
      "EditModalShell.tsx",
      "EditStepContent.tsx",
      "EditWizardActionBar.tsx",
      "EditWizardDialogs.tsx",
      "EditWizardLayout.module.css",
      "EditWizardNavigation.tsx",
      "EditWizardSidebar.tsx",
      "InfoStep.tsx",
      "LocationStep.tsx",
      "PhotosStep.module.css",
      "PhotosStep.tsx",
      "PublishStep.tsx",
      "TimePicker.tsx",
      "TimeStep.module.css",
      "TimeStep.tsx",
      "accommodationTypeIcons.tsx",
      "accommodationEditIcons.tsx",
      "amenityIcons.tsx",
      "editStepIcons.tsx",
      "editorOptions.ts",
      "AccommodationEditComponents.test.tsx",
    ];

    featureComponentFiles.forEach((file) => {
      expect(
        fs.existsSync(path.join(process.cwd(), FEATURE_COMPONENTS_DIR, file)),
      ).toBe(true);
    });
    expect(
      fs.existsSync(
        path.join(
          process.cwd(),
          SCREEN_ROOT_DIR,
          "AccommodationEditScreen.tsx",
        ),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(process.cwd(), SCREEN_ROOT_DIR, "editorViewContract.ts"),
      ),
    ).toBe(true);

    const extractedComponentFiles = [
      "EditStepContent.tsx",
      "EditWizardActionBar.tsx",
      "EditWizardDialogs.tsx",
      "EditWizardNavigation.tsx",
      "EditWizardSidebar.tsx",
    ];
    extractedComponentFiles.forEach((file) => {
      const source = readProjectFile(`${FEATURE_COMPONENTS_DIR}/${file}`);

      expect(source).not.toMatch(/from\s+["'][^"']*(?:\/api\/|\/api|api\/)/);
      expect(source).not.toMatch(/from\s+["'][^"']*services\//);
      expect(source).not.toMatch(/from\s+["'][^"']*platform\//);
      expect(source).not.toMatch(/from\s+["'][^"']*AccommodationEditScreen/);
    });

    const screenSource = readProjectFile(
      `${SCREEN_ROOT_DIR}/AccommodationEditScreen.tsx`,
    );
    expect(screenSource).not.toContain("const STEPS");
    expect(screenSource).not.toContain("stepButtonStyle");
    expect(screenSource).not.toContain("renderStepContent");
    expect(screenSource).not.toContain("Controller");
    expect(screenSource).not.toMatch(/from\s+["'][^"']*platform\//);

    const photosSource = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/PhotosStep.tsx`,
    );
    expect(photosSource).toContain("resolveImageUrl");
    expect(photosSource).not.toContain("getImageUrl");
    expect(photosSource).not.toMatch(/from\s+["'][^"']*platform\//);

    const dialogsSource = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/EditWizardDialogs.tsx`,
    );
    expect(dialogsSource).toContain("ToastHost");
    expect(dialogsSource).not.toContain("ErrorToast");
  });

  it("keeps wizard layout and edit form styles in dedicated CSS modules", () => {
    const formCssPath = path.join(
      process.cwd(),
      `${FEATURE_COMPONENTS_DIR}/EditForm.module.css`,
    );
    const layoutCssPath = path.join(
      process.cwd(),
      `${FEATURE_COMPONENTS_DIR}/EditWizardLayout.module.css`,
    );
    const formClasses = [
      "stepContent",
      "stepTitle",
      "stepDescription",
      "formGroup",
      "label",
      "required",
      "checkboxRow",
      "checkboxTextLabel",
      "checkboxLabel",
      "checkbox",
      "quantityRow",
      "quantityLabel",
      "quantitySelector",
      "quantityButton",
      "quantityValue",
      "input",
      "textarea",
      "priceInput",
      "helperText",
      "addressSearchContainer",
      "addressSearchButton",
      "section",
      "sectionTitle",
      "typeSelectButton",
      "selectedAmenitiesList",
      "selectedAmenityItem",
      "selectedAmenityName",
      "amenityCountSelector",
      "amenityCountButton",
      "amenityCountValue",
      "amenityRemoveButton",
      "addAmenityButton",
    ];
    const layoutClasses = [
      "loading",
      "container",
      "header",
      "title",
      "saveAndExitButton",
      "content",
      "sidebar",
      "stepItem",
      "active",
      "completed",
      "clickable",
      "stepNumber",
      "stepInfo",
      "stepItemTitle",
      "stepItemDescription",
      "mainContent",
      "form",
      "buttonGroup",
      "backButton",
      "nextButton",
      "submitButton",
      "loadingDots",
    ];
    expect(fs.existsSync(formCssPath)).toBe(true);
    expect(fs.existsSync(layoutCssPath)).toBe(true);
    if (!fs.existsSync(formCssPath) || !fs.existsSync(layoutCssPath)) {
      return;
    }

    const formCss = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/EditForm.module.css`,
    );
    const layoutCss = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/EditWizardLayout.module.css`,
    );
    const formFiles = [
      `${FEATURE_COMPONENTS_DIR}/LocationStep.tsx`,
      `${FEATURE_COMPONENTS_DIR}/InfoStep.tsx`,
      `${FEATURE_COMPONENTS_DIR}/PublishStep.tsx`,
      `${FEATURE_COMPONENTS_DIR}/PhotosStep.tsx`,
      `${FEATURE_COMPONENTS_DIR}/TimeStep.tsx`,
    ];

    formFiles.forEach((file) => {
      const source = readProjectFile(file);
      expect(source).toContain("./EditForm.module.css");
      expect(source).not.toContain("../AccommodationEdit.module.css");
    });

    formClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(formCss).toMatch(classSelector);
    });

    layoutClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(layoutCss).toMatch(classSelector);
    });
  });

  it("keeps photo and time styles in step-local CSS modules", () => {
    const photosCssPath = path.join(
      process.cwd(),
      `${FEATURE_COMPONENTS_DIR}/PhotosStep.module.css`,
    );
    const timeCssPath = path.join(
      process.cwd(),
      `${FEATURE_COMPONENTS_DIR}/TimeStep.module.css`,
    );
    const photoClasses = [
      "uploadProgressContainer",
      "uploadProgressBar",
      "uploadProgressFill",
      "uploadProgressText",
      "imageInput",
      "imageUploadBox",
      "imageUploadBoxLabel",
      "cameraIcon",
      "addPhotoButton",
      "uploadedImagesSection",
      "uploadedImagesHeader",
      "uploadedImagesTitle",
      "uploadedImagesSubtitle",
      "addMoreButton",
      "coverPhotoContainer",
      "thumbnailGrid",
      "uploadedImageItem",
      "dragging",
      "dragOver",
      "coverPhotoLabel",
      "uploadedImage",
      "imageMenuButton",
      "addImageSlot",
    ];
    const timeClasses = [
      "formRow",
      "timeInputContainer",
      "timeInputButton",
      "timeDisplay",
      "timePickerDropdown",
      "timePickerContent",
      "timePickerColumn",
      "timePickerHeader",
      "timePickerList",
      "timePickerOption",
      "timePickerOptionSelected",
    ];
    const stalePhotoClasses = [
      "imagePlaceholder",
      "coverPhoto",
      "thumbnailPhoto",
    ];
    const staleTimeClasses = ["timePickerInput", "timePickerOptionEditable"];

    expect(fs.existsSync(photosCssPath)).toBe(true);
    expect(fs.existsSync(timeCssPath)).toBe(true);
    if (!fs.existsSync(photosCssPath) || !fs.existsSync(timeCssPath)) {
      return;
    }

    const photosCss = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/PhotosStep.module.css`,
    );
    const timeCss = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/TimeStep.module.css`,
    );
    const photosStepSource = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/PhotosStep.tsx`,
    );
    const timeStepSource = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/TimeStep.tsx`,
    );
    const timePickerSource = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/TimePicker.tsx`,
    );
    expect(photosStepSource).toContain("./PhotosStep.module.css");
    expect(timeStepSource).toContain("./TimeStep.module.css");
    expect(timePickerSource).toContain("./TimeStep.module.css");
    expect(timePickerSource).not.toContain("../AccommodationEdit.module.css");
    expect(photosStepSource).not.toContain("../AccommodationEdit.module.css");

    photoClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(photosCss).toMatch(classSelector);
    });

    timeClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(timeCss).toMatch(classSelector);
    });

    stalePhotoClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(photosCss).not.toMatch(classSelector);
    });

    staleTimeClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(timeCss).not.toMatch(classSelector);
    });
  });

  it("keeps modal styles in the feature-local modal CSS module", () => {
    const modalCssPath = path.join(
      process.cwd(),
      `${FEATURE_COMPONENTS_DIR}/EditModal.module.css`,
    );
    const formCssPath = path.join(
      process.cwd(),
      `${FEATURE_COMPONENTS_DIR}/EditForm.module.css`,
    );
    const modalStyleFiles = [
      `${FEATURE_COMPONENTS_DIR}/AccommodationTypeModal.tsx`,
      `${FEATURE_COMPONENTS_DIR}/AmenityModal.tsx`,
      `${FEATURE_COMPONENTS_DIR}/DetailAddressConfirmModal.tsx`,
    ];
    const movedClasses = [
      "typeModal",
      "typeModalHeader",
      "typeModalTitle",
      "typeModalClose",
      "typeModalGrid",
      "typeOption",
      "typeOptionSelected",
      "typeOptionIcon",
      "typeOptionLabel",
      "amenityOptionContainer",
      "amenityCountControl",
      "amenityModalFooter",
      "amenityModalDoneButton",
      "confirmModal",
      "confirmModalContent",
      "confirmModalTitle",
      "confirmModalMessage",
      "confirmModalButtons",
      "confirmModalButtonCancel",
      "confirmModalButtonConfirm",
    ];
    const sharedAmenityCountClasses = [
      "amenityCountButton",
      "amenityCountValue",
    ];
    const mobileModalClasses = ["typeModal", "typeModalGrid", "typeOption"];

    expect(fs.existsSync(modalCssPath)).toBe(true);
    expect(fs.existsSync(formCssPath)).toBe(true);
    if (!fs.existsSync(modalCssPath) || !fs.existsSync(formCssPath)) {
      return;
    }

    const modalCss = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/EditModal.module.css`,
    );
    const formCss = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/EditForm.module.css`,
    );

    modalStyleFiles.forEach((file) => {
      const source = readProjectFile(file);
      expect(source).toContain("./EditModal.module.css");
      expect(source).not.toContain("../AccommodationEdit.module.css");
    });

    const modalShellSource = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/EditModalShell.tsx`,
    );
    expect(modalShellSource).toContain("../../../shared/ui");
    expect(modalShellSource).toContain("Dialog");
    expect(modalShellSource).toContain("className={modalClassName}");
    expect(modalShellSource).not.toContain("./EditModal.module.css");
    expect(modalShellSource).not.toContain("../AccommodationEdit.module.css");

    movedClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(modalCss).toMatch(classSelector);
    });

    sharedAmenityCountClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(modalCss).toMatch(classSelector);
      expect(formCss).toMatch(classSelector);
    });

    const amenityModalSource = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/AmenityModal.tsx`,
    );
    const infoStepSource = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/InfoStep.tsx`,
    );

    sharedAmenityCountClasses.forEach((className) => {
      expect(amenityModalSource).toContain(`styles.${className}`);
      expect(infoStepSource).toContain(`styles.${className}`);
    });

    const modalMobileRules = getCssBlocks(
      modalCss,
      "@media (max-width: 768px)",
    ).join("\n");

    mobileModalClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(modalMobileRules).toMatch(classSelector);
    });
  });

  it("renders wizard sidebar steps as semantic buttons", () => {
    const onStepClick = vi.fn();

    render(
      <AccommodationEditScreen
        state={createScreenState()}
        actions={createScreenActions({ onStepClick })}
      />,
    );

    const completedStep = screen.getByRole("button", {
      name: /1\s*위치\s*숙소 위치를 설정하세요/,
    });
    const currentStep = screen.getByRole("button", {
      name: /2\s*숙소 사진\s*숙소 사진을 등록하세요/,
    });
    const lockedStep = screen.getByRole("button", {
      name: /3\s*숙소 정보\s*기본 정보를 입력하세요/,
    });

    expect(currentStep).toHaveAttribute("aria-current", "step");
    expect(completedStep).toBeEnabled();
    expect(lockedStep).toBeDisabled();

    fireEvent.click(completedStep);
    fireEvent.click(lockedStep);

    expect(onStepClick).toHaveBeenCalledTimes(1);
    expect(onStepClick).toHaveBeenCalledWith(1);
  });

  it("renders retry and back-safe actions without mounting the wizard after detail failure", () => {
    const onRetryDetail = vi.fn();
    const onExitDetailError = vi.fn();

    render(
      <AccommodationEditScreen
        state={createScreenState({
          detailState: {
            status: "retryable-load-error",
            accommodationId: "3",
          },
        })}
        actions={createScreenActions({
          onRetryDetail,
          onExitDetailError,
        })}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "숙소 정보를 불러오지 못했어요",
    );
    expect(
      screen.queryByRole("button", { name: "저장 후 나가기" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    fireEvent.click(
      screen.getByRole("button", { name: "호스트 화면으로 돌아가기" }),
    );

    expect(onRetryDetail).toHaveBeenCalledTimes(1);
    expect(onExitDetailError).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["invalid-resource", "숙소 정보를 확인할 수 없어요"],
    ["denied", "이 숙소를 수정할 권한이 없어요"],
  ] as const)(
    "renders the %s terminal without a retry action",
    (status, title) => {
      render(
        <AccommodationEditScreen
          state={createScreenState({
            detailState: { status, accommodationId: "3" },
          })}
          actions={createScreenActions()}
        />,
      );

      expect(screen.getByRole("alert")).toHaveTextContent(title);
      expect(
        screen.queryByRole("button", { name: "다시 시도" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "호스트 화면으로 돌아가기" }),
      ).toBeVisible();
    },
  );

  it("renders editor errors through the shared toast host", () => {
    const onClearError = vi.fn();

    render(
      <AccommodationEditScreen
        state={createScreenState({ error: "저장에 실패했습니다." })}
        actions={createScreenActions({ onClearError })}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("저장에 실패했습니다.");

    fireEvent.click(screen.getByRole("button", { name: "오류 닫기" }));

    expect(onClearError).toHaveBeenCalledTimes(1);
  });

  it("renders a persistent protected-recovery action and locks ordinary edits", () => {
    const onRetryRecovery = vi.fn();

    render(
      <AccommodationEditScreen
        state={createScreenState({
          error: "저장 결과를 복구해야 합니다.",
          recoveryState: "protected-command",
        })}
        actions={createScreenActions({ onRetryRecovery })}
      />,
    );

    expect(screen.getByLabelText("숙소 사진 선택")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "저장 후 나가기" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "오류 닫기" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "복구 다시 시도" }));

    expect(onRetryRecovery).toHaveBeenCalledTimes(1);
  });

  it("keeps save-exit available for delete recovery while locking the draft", () => {
    render(
      <AccommodationEditScreen
        state={createScreenState({
          error: "이미지 삭제 결과를 확인해야 합니다.",
          recoveryState: "protected-delete",
        })}
        actions={createScreenActions()}
      />,
    );

    expect(screen.getByLabelText("숙소 사진 선택")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "저장 후 나가기" }),
    ).toBeEnabled();
  });

  it("resolves persisted photo paths through the injected view dependency", () => {
    const resolveImageUrl = vi.fn((imagePath: string | null | undefined) =>
      imagePath ? `https://images.example/${imagePath}` : "",
    );
    const photosStepProps = {
      imageItems: [{ clientId: "server:1", id: 1, url: "listing/cover.jpg" }],
      isSaving: false,
      isDeletingImage: false,
      uploadProgress: 0,
      draggedIndex: null,
      dragOverIndex: null,
      resolveImageUrl,
      onImageSelect: vi.fn(),
      onDrop: vi.fn(),
      onDragOver: vi.fn(),
      onImageRemove: vi.fn(),
      onDragStart: vi.fn(),
      onDragOverItem: vi.fn(),
      onDragEnd: vi.fn(),
    } satisfies React.ComponentProps<typeof PhotosStep>;

    const { rerender } = render(<PhotosStep {...photosStepProps} />);

    expect(resolveImageUrl).toHaveBeenCalledWith("listing/cover.jpg");
    expect(screen.getByAltText("커버 사진")).toHaveAttribute(
      "src",
      "https://images.example/listing/cover.jpg",
    );

    const fileInput = screen.getByLabelText("숙소 사진 추가 선택");
    const onFileInputClick = vi.fn();
    fileInput.addEventListener("click", onFileInputClick);

    const addImageButton = screen.getByRole("button", { name: "추가" });
    expect(addImageButton).toBeEnabled();
    expect(addImageButton).toHaveAttribute("type", "button");
    fireEvent.click(addImageButton);
    expect(onFileInputClick).toHaveBeenCalledTimes(1);

    for (const lockedState of [
      { isSaving: true, isDeletingImage: false },
      { isSaving: false, isDeletingImage: true },
    ]) {
      rerender(<PhotosStep {...photosStepProps} {...lockedState} />);
      expect(screen.getByRole("button", { name: "추가" })).toBeDisabled();
    }
  });

  it("renders info step fields and forwards edits", () => {
    const onInputChange = vi.fn();
    const onNestedChange = vi.fn();
    const setFormData = vi.fn();
    const onOpenTypeModal = vi.fn();
    const onOpenAmenityModal = vi.fn();

    render(
      <InfoStep
        formData={createFormData()}
        onInputChange={onInputChange}
        onNestedChange={onNestedChange}
        setFormData={setFormData}
        onOpenTypeModal={onOpenTypeModal}
        onOpenAmenityModal={onOpenAmenityModal}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("기존 숙소"), {
      target: { value: "새 숙소" },
    });
    fireEvent.click(screen.getByText("전체 숙소"));
    fireEvent.click(screen.getByText("편의시설 추가"));

    expect(onInputChange).toHaveBeenCalledWith("name", "새 숙소");
    expect(onOpenTypeModal).toHaveBeenCalled();
    expect(onOpenAmenityModal).toHaveBeenCalled();
  });

  it("selects accommodation type from the extracted modal", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <AccommodationTypeModal
        selectedType="ENTIRE_PLACE"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText("개인실"));

    expect(onSelect).toHaveBeenCalledWith("PRIVATE_ROOM");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders edit modals as accessible dialogs and focuses the close action", () => {
    const { unmount } = render(
      <AccommodationTypeModal
        selectedType="ENTIRE_PLACE"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("dialog", {
        name: "다음 중 숙소를 가장 잘 설명하는 것은 무엇인가요?",
      }),
    ).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("모달 닫기")).toHaveFocus();

    unmount();

    render(<DetailAddressConfirmModal onClose={vi.fn()} onConfirm={vi.fn()} />);

    expect(
      screen.getByRole("dialog", { name: "상세 주소 확인" }),
    ).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("취소")).toHaveFocus();
  });

  it("closes edit modals with the Escape key", () => {
    const onClose = vi.fn();

    render(
      <AmenityModal
        amenityInfos={[]}
        setFormData={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(
      screen.getByRole("dialog", { name: "편의시설을 선택하세요" }),
      {
        key: "Escape",
      },
    );

    expect(onClose).toHaveBeenCalled();
  });

  it("selects and increments amenities from the extracted modal", () => {
    const setFormData = vi.fn();
    const onClose = vi.fn();

    render(
      <AmenityModal
        amenityInfos={[]}
        setFormData={setFormData}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText("무선 인터넷"));
    fireEvent.click(screen.getByText("완료"));

    expect(setFormData).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("does not nest amenity count buttons inside selectable controls", () => {
    render(
      <AmenityModal
        amenityInfos={[{ name: "WIFI", count: 1 }]}
        setFormData={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "무선 인터넷" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "무선 인터넷 수량 감소" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "무선 인터넷 수량 증가" }),
    ).toBeInTheDocument();
  });

  it("does not toggle amenity selection when count buttons receive keyboard events", () => {
    const setFormData = vi.fn();

    render(
      <AmenityModal
        amenityInfos={[{ name: "WIFI", count: 1 }]}
        setFormData={setFormData}
        onClose={vi.fn()}
      />,
    );

    const incrementButton = screen.getByRole("button", {
      name: "무선 인터넷 수량 증가",
    });
    expect(
      screen.getByRole("button", { name: "무선 인터넷 수량 감소" }),
    ).toBeDisabled();

    fireEvent.keyDown(incrementButton, { key: "Enter" });

    expect(setFormData).not.toHaveBeenCalled();
  });

  it("renders time step and delegates time picker changes", () => {
    const onTimeChange = vi.fn();
    const setOpenTimePicker = vi.fn();

    render(
      <TimeStep
        checkInTime="15:00:00"
        checkOutTime="11:00:00"
        openTimePicker="checkIn"
        setOpenTimePicker={setOpenTimePicker}
        onTimeChange={onTimeChange}
      />,
    );

    fireEvent.click(screen.getByText("오후"));
    fireEvent.click(screen.getByText("04"));

    expect(onTimeChange).toHaveBeenCalledWith("checkIn", 4, 0, "PM");
  });

  it("renders standalone time picker controls", () => {
    const onChange = vi.fn();

    render(<TimePicker hour={3} minute={0} period="PM" onChange={onChange} />);

    fireEvent.click(screen.getByText("30"));

    expect(onChange).toHaveBeenCalledWith(3, 30, "PM");
  });

  it("closes the time popover on Escape and restores its trigger focus", async () => {
    function TimeStepFixture() {
      const [openTimePicker, setOpenTimePicker] = React.useState<
        "checkIn" | "checkOut" | null
      >(null);

      return (
        <TimeStep
          checkInTime="15:00:00"
          checkOutTime="11:00:00"
          openTimePicker={openTimePicker}
          setOpenTimePicker={setOpenTimePicker}
          onTimeChange={vi.fn()}
        />
      );
    }

    render(
      <OverlayProvider>
        <TimeStepFixture />
      </OverlayProvider>,
    );

    const checkInTrigger = screen.getByRole("button", {
      name: /오후 03:00/,
    });
    await userEvent.click(checkInTrigger);
    const hourOption = screen.getByRole("button", { name: "04" });
    hourOption.focus();

    await userEvent.keyboard("{Escape}");

    expect(
      screen.queryByRole("button", { name: "04" }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(checkInTrigger).toHaveFocus());
    expect(document.body).toHaveStyle({ overflow: "" });
  });

  it("renders publish and detail-address confirmation components", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <>
        <PublishStep />
        <DetailAddressConfirmModal onClose={onClose} onConfirm={onConfirm} />
      </>,
    );

    expect(screen.getByText("숙소를 등록하세요")).toBeInTheDocument();

    fireEvent.click(screen.getByText("진행하기"));
    expect(onConfirm).toHaveBeenCalled();

    fireEvent.click(screen.getByText("취소"));
    expect(onClose).toHaveBeenCalled();
  });
});
