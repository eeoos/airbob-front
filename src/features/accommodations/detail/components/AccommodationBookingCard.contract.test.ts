import { readFileSync } from "node:fs";
import { join } from "node:path";

const readSource = (fileName: string) =>
  readFileSync(join(__dirname, fileName), "utf8");

describe("AccommodationBookingCard action contract", () => {
  it("exposes value-based semantic callbacks instead of React setters", () => {
    const source = [
      readSource("AccommodationBookingCard.tsx"),
      readSource("AccommodationBookingCardSections.tsx"),
    ].join("\n");

    [
      "onDatePickerOpenChange",
      "onGuestPickerOpenChange",
      "onAdultCountChange",
      "onChildCountChange",
      "onInfantCountChange",
      "onPetCountChange",
      "onSelectedCouponIdChange",
    ].forEach((callbackName) => expect(source).toContain(callbackName));

    expect(source).not.toMatch(/React[.]Dispatch|SetStateAction/);
    expect(source).not.toMatch(
      /\bset(?:IsDatePickerOpen|IsGuestPickerOpen|AdultCount|ChildCount|InfantCount|PetCount|SelectedCouponId)\b/,
    );
  });
});
