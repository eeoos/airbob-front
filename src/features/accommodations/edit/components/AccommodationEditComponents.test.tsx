import * as fs from "fs";
import * as path from "path";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  AccommodationEditFormData,
  createDefaultAccommodationEditFormData,
} from "../lib/accommodationEditMapper";
import { AccommodationTypeModal } from "./AccommodationTypeModal";
import { AmenityModal } from "./AmenityModal";
import { DetailAddressConfirmModal } from "./DetailAddressConfirmModal";
import { InfoStep } from "./InfoStep";
import { PublishStep } from "./PublishStep";
import { TimePicker } from "./TimePicker";
import { TimeStep } from "./TimeStep";

const createFormData = (
  overrides: Partial<AccommodationEditFormData> = {}
): AccommodationEditFormData => ({
  ...createDefaultAccommodationEditFormData(),
  name: "기존 숙소",
  description: "기존 설명",
  basePrice: "120000",
  type: "ENTIRE_PLACE",
  amenityInfos: [{ name: "WIFI", count: 1 }],
  ...overrides,
});

const readProjectFile = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const FEATURE_COMPONENTS_DIR =
  "src/features/accommodations/edit/components";
const PAGE_COMPONENTS_DIR = ["src", "pages", "AccommodationEdit", "components"].join(
  "/"
);
const PAGE_SOURCE_PATH = "src/pages/AccommodationEdit/AccommodationEdit.tsx";
const LEGACY_PAGE_CSS_PATH =
  "src/pages/AccommodationEdit/AccommodationEdit.module.css";

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
  it("keeps edit UI components owned by the accommodations edit feature", () => {
    const featureComponentFiles = [
      "AccommodationEditScreen.tsx",
      "AccommodationTypeModal.tsx",
      "AmenityModal.tsx",
      "DetailAddressConfirmModal.tsx",
      "EditForm.module.css",
      "EditModal.module.css",
      "EditModalShell.tsx",
      "EditWizardLayout.module.css",
      "InfoStep.tsx",
      "LocationStep.tsx",
      "PhotosStep.module.css",
      "PhotosStep.tsx",
      "PublishStep.tsx",
      "TimePicker.tsx",
      "TimeStep.module.css",
      "TimeStep.tsx",
      "accommodationEditIcons.tsx",
      "AccommodationEditComponents.test.tsx",
    ];

    featureComponentFiles.forEach((file) => {
      expect(
        fs.existsSync(path.join(process.cwd(), FEATURE_COMPONENTS_DIR, file))
      ).toBe(true);
    });
    expect(fs.existsSync(path.join(process.cwd(), PAGE_COMPONENTS_DIR))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), LEGACY_PAGE_CSS_PATH))).toBe(
      false
    );

    const pageSource = readProjectFile(PAGE_SOURCE_PATH);
    expect(pageSource).toContain("../../features/accommodations/edit");
    expect(pageSource).toContain("AccommodationEditRoute");
    expect(pageSource).not.toMatch(/from\s+["']\.\/components\//);
    expect(pageSource).not.toMatch(
      /features\/accommodations\/edit\/(?:components|hooks|lib)\//
    );
    expect(pageSource).not.toMatch(/from\s+["'][^"']*components\/[^"']+\.module\.css["']/);
  });

  it("keeps wizard layout and edit form styles in dedicated CSS modules", () => {
    const formCssPath = path.join(
      process.cwd(),
      `${FEATURE_COMPONENTS_DIR}/EditForm.module.css`
    );
    const layoutCssPath = path.join(
      process.cwd(),
      `${FEATURE_COMPONENTS_DIR}/EditWizardLayout.module.css`
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
      "toastContainer",
    ];
    expect(fs.existsSync(formCssPath)).toBe(true);
    expect(fs.existsSync(layoutCssPath)).toBe(true);
    if (!fs.existsSync(formCssPath) || !fs.existsSync(layoutCssPath)) {
      return;
    }

    const formCss = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/EditForm.module.css`
    );
    const layoutCss = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/EditWizardLayout.module.css`
    );
    const pageSource = readProjectFile(PAGE_SOURCE_PATH);
    const formFiles = [
      `${FEATURE_COMPONENTS_DIR}/LocationStep.tsx`,
      `${FEATURE_COMPONENTS_DIR}/InfoStep.tsx`,
      `${FEATURE_COMPONENTS_DIR}/PublishStep.tsx`,
      `${FEATURE_COMPONENTS_DIR}/PhotosStep.tsx`,
      `${FEATURE_COMPONENTS_DIR}/TimeStep.tsx`,
    ];

    expect(pageSource).toContain("../../features/accommodations/edit");
    expect(pageSource).not.toContain("AccommodationEditScreen");
    expect(pageSource).not.toMatch(/from\s+["'][^"']*EditWizardLayout\.module\.css["']/);
    expect(pageSource).not.toContain("./AccommodationEdit.module.css");

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
      `${FEATURE_COMPONENTS_DIR}/PhotosStep.module.css`
    );
    const timeCssPath = path.join(
      process.cwd(),
      `${FEATURE_COMPONENTS_DIR}/TimeStep.module.css`
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
    const stalePhotoClasses = ["imagePlaceholder", "coverPhoto", "thumbnailPhoto"];
    const staleTimeClasses = ["timePickerInput", "timePickerOptionEditable"];

    expect(fs.existsSync(photosCssPath)).toBe(true);
    expect(fs.existsSync(timeCssPath)).toBe(true);
    if (!fs.existsSync(photosCssPath) || !fs.existsSync(timeCssPath)) {
      return;
    }

    const photosCss = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/PhotosStep.module.css`
    );
    const timeCss = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/TimeStep.module.css`
    );
    const photosStepSource = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/PhotosStep.tsx`
    );
    const timeStepSource = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/TimeStep.tsx`
    );
    const timePickerSource = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/TimePicker.tsx`
    );
    const pageSource = readProjectFile(PAGE_SOURCE_PATH);

    expect(photosStepSource).toContain("./PhotosStep.module.css");
    expect(timeStepSource).toContain("./TimeStep.module.css");
    expect(timePickerSource).toContain("./TimeStep.module.css");
    expect(timePickerSource).not.toContain("../AccommodationEdit.module.css");
    expect(pageSource).not.toMatch(/from\s+["'][^"']*TimeStep\.module\.css["']/);
    expect(pageSource).not.toContain("timeStyles.timeInputContainer");
    expect(pageSource).not.toContain("styles.timeInputContainer");

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
      `${FEATURE_COMPONENTS_DIR}/EditModal.module.css`
    );
    const formCssPath = path.join(
      process.cwd(),
      `${FEATURE_COMPONENTS_DIR}/EditForm.module.css`
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
      `${FEATURE_COMPONENTS_DIR}/EditModal.module.css`
    );
    const formCss = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/EditForm.module.css`
    );

    modalStyleFiles.forEach((file) => {
      const source = readProjectFile(file);
      expect(source).toContain("./EditModal.module.css");
      expect(source).not.toContain("../AccommodationEdit.module.css");
    });

    const modalShellSource = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/EditModalShell.tsx`
    );
    expect(modalShellSource).toContain("../../../../shared/ui");
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
      `${FEATURE_COMPONENTS_DIR}/AmenityModal.tsx`
    );
    const infoStepSource = readProjectFile(
      `${FEATURE_COMPONENTS_DIR}/InfoStep.tsx`
    );

    sharedAmenityCountClasses.forEach((className) => {
      expect(amenityModalSource).toContain(`styles.${className}`);
      expect(infoStepSource).toContain(`styles.${className}`);
    });

    const modalMobileRules = getCssBlocks(modalCss, "@media (max-width: 768px)")
      .join("\n");

    mobileModalClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(modalMobileRules).toMatch(classSelector);
    });
  });

  it("renders info step fields and forwards edits", () => {
    const onInputChange = jest.fn();
    const onNestedChange = jest.fn();
    const setFormData = jest.fn();
    const setSelectedAmenities = jest.fn();
    const onOpenTypeModal = jest.fn();
    const onOpenAmenityModal = jest.fn();

    render(
      <InfoStep
        formData={createFormData()}
        onInputChange={onInputChange}
        onNestedChange={onNestedChange}
        setFormData={setFormData}
        setSelectedAmenities={setSelectedAmenities}
        onOpenTypeModal={onOpenTypeModal}
        onOpenAmenityModal={onOpenAmenityModal}
      />
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
    const onSelect = jest.fn();
    const onClose = jest.fn();

    render(
      <AccommodationTypeModal
        selectedType="ENTIRE_PLACE"
        onSelect={onSelect}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByText("개인실"));

    expect(onSelect).toHaveBeenCalledWith("PRIVATE_ROOM");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders edit modals as accessible dialogs and focuses the close action", () => {
    const { unmount } = render(
      <AccommodationTypeModal
        selectedType="ENTIRE_PLACE"
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(
      screen.getByRole("dialog", {
        name: "다음 중 숙소를 가장 잘 설명하는 것은 무엇인가요?",
      })
    ).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("모달 닫기")).toHaveFocus();

    unmount();

    render(
      <DetailAddressConfirmModal onClose={jest.fn()} onConfirm={jest.fn()} />
    );

    expect(
      screen.getByRole("dialog", { name: "상세 주소 확인" })
    ).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("취소")).toHaveFocus();
  });

  it("closes edit modals with the Escape key", () => {
    const onClose = jest.fn();

    render(
      <AmenityModal
        amenityInfos={[]}
        selectedAmenities={new Set()}
        setFormData={jest.fn()}
        setSelectedAmenities={jest.fn()}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(screen.getByRole("dialog", { name: "편의시설을 선택하세요" }), {
      key: "Escape",
    });

    expect(onClose).toHaveBeenCalled();
  });

  it("selects and increments amenities from the extracted modal", () => {
    const setFormData = jest.fn();
    const setSelectedAmenities = jest.fn();
    const onClose = jest.fn();

    render(
      <AmenityModal
        amenityInfos={[]}
        selectedAmenities={new Set()}
        setFormData={setFormData}
        setSelectedAmenities={setSelectedAmenities}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByText("무선 인터넷"));
    fireEvent.click(screen.getByText("완료"));

    expect(setSelectedAmenities).toHaveBeenCalled();
    expect(setFormData).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("does not nest amenity count buttons inside selectable controls", () => {
    const { container } = render(
      <AmenityModal
        amenityInfos={[{ name: "WIFI", count: 1 }]}
        selectedAmenities={new Set(["WIFI"])}
        setFormData={jest.fn()}
        setSelectedAmenities={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(container.querySelector("button button")).toBeNull();
    expect(container.querySelector('[role="button"] button')).toBeNull();
  });

  it("does not toggle amenity selection when count buttons receive keyboard events", () => {
    const setFormData = jest.fn();
    const setSelectedAmenities = jest.fn();

    render(
      <AmenityModal
        amenityInfos={[{ name: "WIFI", count: 1 }]}
        selectedAmenities={new Set(["WIFI"])}
        setFormData={setFormData}
        setSelectedAmenities={setSelectedAmenities}
        onClose={jest.fn()}
      />
    );

    const incrementButton = screen.getByRole("button", {
      name: "무선 인터넷 수량 증가",
    });
    expect(
      screen.getByRole("button", { name: "무선 인터넷 수량 감소" })
    ).toBeDisabled();

    fireEvent.keyDown(incrementButton, { key: "Enter" });

    expect(setFormData).not.toHaveBeenCalled();
    expect(setSelectedAmenities).not.toHaveBeenCalled();
  });

  it("renders time step and delegates time picker changes", () => {
    const onTimeChange = jest.fn();
    const setOpenTimePicker = jest.fn();

    render(
      <TimeStep
        checkInTime="15:00:00"
        checkOutTime="11:00:00"
        openTimePicker="checkIn"
        setOpenTimePicker={setOpenTimePicker}
        onTimeChange={onTimeChange}
      />
    );

    fireEvent.click(screen.getByText("오후"));
    fireEvent.click(screen.getByText("04"));

    expect(onTimeChange).toHaveBeenCalledWith("checkIn", 4, 0, "PM");
  });

  it("renders standalone time picker controls", () => {
    const onChange = jest.fn();

    render(
      <TimePicker
        hour={3}
        minute={0}
        period="PM"
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByText("30"));

    expect(onChange).toHaveBeenCalledWith(3, 30, "PM");
  });

  it("renders publish and detail-address confirmation components", () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();

    render(
      <>
        <PublishStep />
        <DetailAddressConfirmModal onClose={onClose} onConfirm={onConfirm} />
      </>
    );

    expect(screen.getByText("숙소를 등록하세요")).toBeInTheDocument();

    fireEvent.click(screen.getByText("진행하기"));
    expect(onConfirm).toHaveBeenCalled();

    fireEvent.click(screen.getByText("취소"));
    expect(onClose).toHaveBeenCalled();
  });
});
