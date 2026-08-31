import { useCallback, useEffect, useRef } from "react";
import type { ListingEditorAddressSelection } from "../../features/accommodations/listing-editor/model/listingEditorAddress";

export interface ListingEditorAddressSearchPort {
  search(options: {
    readonly signal: AbortSignal;
  }): Promise<ListingEditorAddressSelection>;
}

const ADDRESS_SEARCH_UNAVAILABLE =
  "주소 검색 서비스를 불러올 수 없습니다. 페이지를 새로고침해주세요.";

export const useListingEditorAddressSearch = ({
  onAddressSelected,
  onError,
  port,
}: {
  readonly onAddressSelected: (address: ListingEditorAddressSelection) => void;
  readonly onError: (message: string) => void;
  readonly port: ListingEditorAddressSearchPort;
}) => {
  const activeSearchRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      activeSearchRef.current?.abort();
      activeSearchRef.current = null;
    },
    [],
  );

  const openAddressSearch = useCallback(() => {
    activeSearchRef.current?.abort();
    const controller = new AbortController();
    activeSearchRef.current = controller;

    void port
      .search({ signal: controller.signal })
      .then((address) => {
        if (
          controller.signal.aborted ||
          activeSearchRef.current !== controller
        ) {
          return;
        }
        activeSearchRef.current = null;
        onAddressSelected(address);
      })
      .catch(() => {
        if (
          controller.signal.aborted ||
          activeSearchRef.current !== controller
        ) {
          return;
        }
        activeSearchRef.current = null;
        onError(ADDRESS_SEARCH_UNAVAILABLE);
      });
  }, [onAddressSelected, onError, port]);

  return { openAddressSearch };
};
