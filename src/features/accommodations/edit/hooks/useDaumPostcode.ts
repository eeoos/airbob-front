import { useCallback, useEffect, useRef } from "react";
import { openDaumPostcode } from "../../../../platform/integrations/daumPostcode";
import {
  AccommodationEditAddressInfo,
  mapDaumPostcodeToAddressInfo,
} from "../lib/daumAddressMapper";

interface UseDaumPostcodeOptions {
  onAddressSelected: (addressInfo: AccommodationEditAddressInfo) => void;
  alert?: (message: string) => void;
}

const DAUM_POSTCODE_UNAVAILABLE_MESSAGE =
  "주소 검색 서비스를 불러올 수 없습니다. 페이지를 새로고침해주세요.";

export const useDaumPostcode = ({
  onAddressSelected,
  alert: alertUser,
}: UseDaumPostcodeOptions) => {
  const activeOperationRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      activeOperationRef.current?.abort();
      activeOperationRef.current = null;
    },
    [],
  );

  const openAddressSearch = useCallback(() => {
    activeOperationRef.current?.abort();
    const operation = new AbortController();
    activeOperationRef.current = operation;

    const finishOperation = () => {
      if (activeOperationRef.current === operation) {
        activeOperationRef.current = null;
      }
    };

    const showUnavailable = () => {
      if (operation.signal.aborted) return;
      finishOperation();
      (alertUser || window.alert)(DAUM_POSTCODE_UNAVAILABLE_MESSAGE);
    };

    void openDaumPostcode(
      (data) => {
        if (operation.signal.aborted) return;
        finishOperation();
        onAddressSelected(mapDaumPostcodeToAddressInfo(data));
      },
      showUnavailable,
      operation.signal,
    )
      .catch(showUnavailable);
  }, [alertUser, onAddressSelected]);

  return {
    openAddressSearch,
  };
};
