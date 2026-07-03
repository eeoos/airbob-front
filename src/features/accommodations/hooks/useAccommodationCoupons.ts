import { useCallback, useEffect, useMemo, useState } from "react";
import { couponApi } from "../../../api";
import { CouponInfo } from "../../../types/coupon";
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

export const useAccommodationCoupons = ({
  isAuthenticated,
  totalPrice,
  handleError,
  clearError,
  onRequireAuth,
}: UseAccommodationCouponsOptions) => {
  const [coupons, setCoupons] = useState<CouponInfo[]>([]);
  const [isLoadingCoupons, setIsLoadingCoupons] = useState(false);
  const [selectedCouponId, setSelectedCouponId] = useState<number | null>(null);
  const [issuingCouponId, setIssuingCouponId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setCoupons([]);
      setSelectedCouponId(null);
      return;
    }

    let isCancelled = false;

    const fetchCoupons = async () => {
      setIsLoadingCoupons(true);

      try {
        const data = await couponApi.getValidCoupons();
        if (!isCancelled) {
          setCoupons(data.infos || []);
        }
      } catch (error) {
        console.error("쿠폰 목록 조회 실패:", error);
        if (!isCancelled) {
          setCoupons([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingCoupons(false);
        }
      }
    };

    fetchCoupons();

    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated]);

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
    isLoadingCoupons,
    selectedCoupon,
    selectedCouponId,
    setSelectedCouponId,
    issuingCouponId,
    couponDiscount,
    payablePrice,
    handleIssueCoupon,
  };
};
