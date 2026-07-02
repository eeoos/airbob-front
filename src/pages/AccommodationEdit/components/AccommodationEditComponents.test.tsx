import * as fs from "fs";
import * as path from "path";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  AccommodationEditFormData,
  createDefaultAccommodationEditFormData,
} from "../../../features/accommodations/edit/lib/accommodationEditMapper";
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

const readOptionalProjectFile = (relativePath: string) => {
  const absolutePath = path.join(process.cwd(), relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
};

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
  it("keeps wizard layout and edit form styles in dedicated CSS modules", () => {
    const formCssPath = path.join(
      process.cwd(),
      "src/pages/AccommodationEdit/components/EditForm.module.css"
    );
    const layoutCssPath = path.join(
      process.cwd(),
      "src/pages/AccommodationEdit/components/EditWizardLayout.module.css"
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
    const stalePageClasses = [
      ...formClasses,
      ...layoutClasses,
      "select",
      "modalOverlay",
      "modalContent",
      "modalHeader",
      "modalCloseButton",
      "modalAddButton",
      "modalTitle",
      "modalBody",
      "modalSelectedFiles",
      "modalDropZone",
      "dropZoneIcon",
      "dropZoneText",
      "dropZoneSubtext",
      "browseButton",
      "modalFooter",
      "modalDoneButton",
      "modalUploadButton",
    ];

    expect(fs.existsSync(formCssPath)).toBe(true);
    expect(fs.existsSync(layoutCssPath)).toBe(true);
    if (!fs.existsSync(formCssPath) || !fs.existsSync(layoutCssPath)) {
      return;
    }

    const formCss = readProjectFile(
      "src/pages/AccommodationEdit/components/EditForm.module.css"
    );
    const layoutCss = readProjectFile(
      "src/pages/AccommodationEdit/components/EditWizardLayout.module.css"
    );
    const pageCss = readOptionalProjectFile(
      "src/pages/AccommodationEdit/AccommodationEdit.module.css"
    );
    const pageSource = readProjectFile(
      "src/pages/AccommodationEdit/AccommodationEdit.tsx"
    );
    const formFiles = [
      "src/pages/AccommodationEdit/components/LocationStep.tsx",
      "src/pages/AccommodationEdit/components/InfoStep.tsx",
      "src/pages/AccommodationEdit/components/PublishStep.tsx",
      "src/pages/AccommodationEdit/components/PhotosStep.tsx",
      "src/pages/AccommodationEdit/components/TimeStep.tsx",
    ];

    expect(pageSource).toContain("./components/EditWizardLayout.module.css");
    expect(pageSource).not.toContain("./AccommodationEdit.module.css");

    formFiles.forEach((file) => {
      const source = readProjectFile(file);
      expect(source).toContain("./EditForm.module.css");
      expect(source).not.toContain("../AccommodationEdit.module.css");
    });

    formClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(formCss).toMatch(classSelector);
      expect(pageCss).not.toMatch(classSelector);
    });

    layoutClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(layoutCss).toMatch(classSelector);
      expect(pageCss).not.toMatch(classSelector);
    });

    stalePageClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(pageCss).not.toMatch(classSelector);
    });
  });

  it("keeps photo and time styles in step-local CSS modules", () => {
    const photosCssPath = path.join(
      process.cwd(),
      "src/pages/AccommodationEdit/components/PhotosStep.module.css"
    );
    const timeCssPath = path.join(
      process.cwd(),
      "src/pages/AccommodationEdit/components/TimeStep.module.css"
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
      "src/pages/AccommodationEdit/components/PhotosStep.module.css"
    );
    const timeCss = readProjectFile(
      "src/pages/AccommodationEdit/components/TimeStep.module.css"
    );
    const pageCss = readOptionalProjectFile(
      "src/pages/AccommodationEdit/AccommodationEdit.module.css"
    );
    const photosStepSource = readProjectFile(
      "src/pages/AccommodationEdit/components/PhotosStep.tsx"
    );
    const timeStepSource = readProjectFile(
      "src/pages/AccommodationEdit/components/TimeStep.tsx"
    );
    const timePickerSource = readProjectFile(
      "src/pages/AccommodationEdit/components/TimePicker.tsx"
    );
    const pageSource = readProjectFile(
      "src/pages/AccommodationEdit/AccommodationEdit.tsx"
    );

    expect(photosStepSource).toContain("./PhotosStep.module.css");
    expect(timeStepSource).toContain("./TimeStep.module.css");
    expect(timePickerSource).toContain("./TimeStep.module.css");
    expect(timePickerSource).not.toContain("../AccommodationEdit.module.css");
    expect(pageSource).toContain("./components/TimeStep.module.css");
    expect(pageSource).toContain("timeStyles.timeInputContainer");
    expect(pageSource).not.toContain("styles.timeInputContainer");

    photoClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(photosCss).toMatch(classSelector);
      expect(pageCss).not.toMatch(classSelector);
    });

    timeClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(timeCss).toMatch(classSelector);
      expect(pageCss).not.toMatch(classSelector);
    });

    stalePhotoClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(photosCss).not.toMatch(classSelector);
      expect(pageCss).not.toMatch(classSelector);
    });

    staleTimeClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(timeCss).not.toMatch(classSelector);
      expect(pageCss).not.toMatch(classSelector);
    });
  });

  it("keeps modal styles in the page-local modal CSS module", () => {
    const modalCssPath = path.join(
      process.cwd(),
      "src/pages/AccommodationEdit/components/EditModal.module.css"
    );
    const formCssPath = path.join(
      process.cwd(),
      "src/pages/AccommodationEdit/components/EditForm.module.css"
    );
    const modalFiles = [
      "src/pages/AccommodationEdit/components/AccommodationTypeModal.tsx",
      "src/pages/AccommodationEdit/components/AmenityModal.tsx",
      "src/pages/AccommodationEdit/components/DetailAddressConfirmModal.tsx",
      "src/pages/AccommodationEdit/components/EditModalShell.tsx",
    ];
    const movedClasses = [
      "typeModalOverlay",
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
      "src/pages/AccommodationEdit/components/EditModal.module.css"
    );
    const formCss = readProjectFile(
      "src/pages/AccommodationEdit/components/EditForm.module.css"
    );
    const pageCss = readOptionalProjectFile(
      "src/pages/AccommodationEdit/AccommodationEdit.module.css"
    );

    modalFiles.forEach((file) => {
      const source = readProjectFile(file);
      expect(source).toContain("./EditModal.module.css");
      expect(source).not.toContain("../AccommodationEdit.module.css");
    });

    movedClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(modalCss).toMatch(classSelector);
      expect(pageCss).not.toMatch(classSelector);
    });

    sharedAmenityCountClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(modalCss).toMatch(classSelector);
      expect(formCss).toMatch(classSelector);
      expect(pageCss).not.toMatch(classSelector);
    });

    const amenityModalSource = readProjectFile(
      "src/pages/AccommodationEdit/components/AmenityModal.tsx"
    );
    const infoStepSource = readProjectFile(
      "src/pages/AccommodationEdit/components/InfoStep.tsx"
    );

    sharedAmenityCountClasses.forEach((className) => {
      expect(amenityModalSource).toContain(`styles.${className}`);
      expect(infoStepSource).toContain(`styles.${className}`);
    });

    const modalMobileRules = getCssBlocks(modalCss, "@media (max-width: 768px)")
      .join("\n");
    const pageMobileRules = getCssBlocks(pageCss, "@media (max-width: 768px)")
      .join("\n");

    mobileModalClasses.forEach((className) => {
      const classSelector = new RegExp(`\\.${className}(?![A-Za-z0-9_-])`);
      expect(modalMobileRules).toMatch(classSelector);
      expect(pageMobileRules).not.toMatch(classSelector);
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

    fireEvent.keyDown(document, { key: "Escape" });

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

  it("does not nest amenity count buttons inside selectable buttons", () => {
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

    const incrementButton = screen.getAllByRole("button").find(
      (button) =>
        button.tagName === "BUTTON" &&
        button.querySelector('line[x1="12"][y1="5"]')
    );
    if (!incrementButton) {
      throw new Error("increment button not found");
    }

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
        onClose={jest.fn()}
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
