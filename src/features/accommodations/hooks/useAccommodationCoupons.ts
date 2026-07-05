import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { couponApi } from "../../../api";
import { CouponInfo, CouponInfos } from "../../../types/coupon";
import { calculateCouponDiscount } from "../../../utils/codes";
import { parseApiError } from "../../../utils/error";

interface UseAccommodationCouponsOptions {
  isAuthenticated: boolean;
  totalPrice: number;
  handleError: (error: unknown) => unknown;
  clearError: () => void;
  onRequireAuth: (action: () => void | Promise<void>) => void;
}

interface IssueCouponOptions {
  skipAuthCheck?: boolean;
}

const accommodationCouponsQueryKey = () =>
  ["accommodation", "coupons", "valid"] as const;

export const useAccommodationCoupons = ({
  isAuthenticated,
  totalPrice,
  handleError,
  clearError,
  onRequireAuth,
}: UseAccommodationCouponsOptions) => {
  const [coupons, setCoupons] = useState<CouponInfo[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState<number | null>(null);
  const [issuingCouponId, setIssuingCouponId] = useState<number | null>(null);
  const handledCouponErrorUpdatedAtRef = useRef(0);

  const couponsQuery = useQuery<
    CouponInfos,
    unknown,
    CouponInfos,
    ReturnType<typeof accommodationCouponsQueryKey>
  >({
    queryKey: accommodationCouponsQueryKey(),
    queryFn: () => couponApi.getValidCoupons(),
    enabled: isAuthenticated,
    retry: false,
    throwOnError: false,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setCoupons([]);
      setSelectedCouponId(null);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!couponsQuery.data || !isAuthenticated) {
      return;
    }

    setCoupons(couponsQuery.data.infos || []);
  }, [couponsQuery.data, couponsQuery.dataUpdatedAt, isAuthenticated]);

  useEffect(() => {
    if (
      !couponsQuery.isError ||
      !couponsQuery.error ||
      handledCouponErrorUpdatedAtRef.current === couponsQuery.errorUpdatedAt
    ) {
      return;
    }

    handledCouponErrorUpdatedAtRef.current = couponsQuery.errorUpdatedAt;
    console.error("쿠폰 목록 조회 실패:", couponsQuery.error);
    setCoupons([]);
  }, [
    couponsQuery.error,
    couponsQuery.errorUpdatedAt,
    couponsQuery.isError,
  ]);

  const selectedCoupon = useMemo(
    () => coupons.find((coupon) => coupon.id === selectedCouponId) || null,
    [coupons, selectedCouponId]
  );

  const couponDiscount = useMemo(() => {
    if (!selectedCoupon || totalPrice <= 0) {
      return 0;
    }

    return calculateCouponDiscount(selectedCoupon, totalPrice);
  }, [selectedCoupon, totalPrice]);

  const payablePrice = Math.max(totalPrice - couponDiscount, 0);

  const handleIssueCoupon = useCallback(async function issueCoupon(
    coupon: CouponInfo,
    options: IssueCouponOptions = {}
  ) {
    if (!options.skipAuthCheck && !isAuthenticated) {
      onRequireAuth(() => issueCoupon(coupon, { skipAuthCheck: true }));
      return;
    }

    setIssuingCouponId(coupon.id);
    clearError();

    try {
      await couponApi.issue(coupon.id);
      setSelectedCouponId(coupon.id);
    } catch (error) {
      const apiError = parseApiError(error);
      if (apiError?.code === "CP003") {
        setSelectedCouponId(coupon.id);
      } else {
        handleError(error);
      }
    } finally {
      setIssuingCouponId(null);
    }
  }, [clearError, handleError, isAuthenticated, onRequireAuth]);

  return {
    coupons,
    isLoadingCoupons: isAuthenticated && couponsQuery.isFetching,
    selectedCoupon,
    selectedCouponId,
    setSelectedCouponId,
    issuingCouponId,
    couponDiscount,
    payablePrice,
    handleIssueCoupon,
  };
};
