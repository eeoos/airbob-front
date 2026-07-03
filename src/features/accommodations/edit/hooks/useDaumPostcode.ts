import { useCallback } from "react";
import {
  AccommodationEditAddressInfo,
  DaumPostcodeData,
  mapDaumPostcodeToAddressInfo,
} from "../lib/daumAddressMapper";

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeData) => void;
        width?: string;
        height?: string;
        maxSuggestItems?: number;
      }) => {
        open: () => void;
        embed: (element: HTMLElement) => void;
      };
    };
  }
}

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
  const openAddressSearch = useCallback(() => {
    if (!window.daum || !window.daum.Postcode) {
      (alertUser || window.alert)(DAUM_POSTCODE_UNAVAILABLE_MESSAGE);
      return;
    }

    new window.daum.Postcode({
      oncomplete: (data) => {
        onAddressSelected(mapDaumPostcodeToAddressInfo(data));
      },
      width: "100%",
      height: "100%",
    }).open();
  }, [alertUser, onAddressSelected]);

  return {
    openAddressSearch,
  };
};
