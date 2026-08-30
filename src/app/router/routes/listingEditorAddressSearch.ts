import {
  toListingEditorAddressSelection,
  type ListingEditorAddressSelection,
} from "../../../features/accommodations/listing-editor/public";
import {
  openDaumPostcode,
  type DaumPostcodeResult,
} from "../../../platform/integrations/daumPostcode";
import type { ListingEditorAddressSearchPort } from "../../../screens/accommodation-edit/public";

type OpenPostcode = typeof openDaumPostcode;
type MapAddressSelection = (
  result: DaumPostcodeResult,
) => ListingEditorAddressSelection;

interface ListingEditorAddressSearchDependencies {
  readonly mapAddressSelection?: MapAddressSelection;
  readonly openPostcode?: OpenPostcode;
}

const createAbortError = () =>
  new DOMException("The address search was aborted.", "AbortError");

export const createListingEditorAddressSearch = ({
  mapAddressSelection = toListingEditorAddressSelection,
  openPostcode = openDaumPostcode,
}: ListingEditorAddressSearchDependencies = {}): ListingEditorAddressSearchPort => ({
  search({ signal }) {
    return new Promise((resolve, reject) => {
      let listening = false;
      let settled = false;

      const cleanup = () => {
        if (!listening) return;
        signal.removeEventListener("abort", handleAbort);
        listening = false;
      };
      const resolveOnce = (address: ListingEditorAddressSelection) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(address);
      };
      const rejectOnce = (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      function handleAbort() {
        rejectOnce(createAbortError());
      }

      if (signal.aborted) {
        handleAbort();
        return;
      }

      signal.addEventListener("abort", handleAbort, { once: true });
      listening = true;

      const handleComplete = (result: DaumPostcodeResult) => {
        if (settled) return;
        try {
          resolveOnce(mapAddressSelection(result));
        } catch (error) {
          rejectOnce(error);
        }
      };

      try {
        void openPostcode(handleComplete, rejectOnce, signal).catch(rejectOnce);
      } catch (error) {
        rejectOnce(error);
      }
    });
  },
});

export const listingEditorAddressSearch =
  createListingEditorAddressSearch();
