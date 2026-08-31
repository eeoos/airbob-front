import { IntegrationError, type IntegrationErrorCode } from "./errors";

export interface DaumPostcodeResult {
  zonecode: string;
  address: string;
  addressEnglish: string;
  addressType: string;
  bname: string;
  buildingName: string;
  apartment: string;
  sido: string;
  sigungu: string;
  sigunguCode: string;
  bcode: string;
  roadname: string;
  roadnameCode: string;
  jibunAddress: string;
  roadAddress?: string;
}

interface DaumPostcodeInstance {
  embed: (element: HTMLElement) => void;
  open: () => void;
}

interface DaumPostcodeConstructor {
  new (options: {
    oncomplete: (data: unknown) => void;
    width: string;
    height: string;
  }): DaumPostcodeInstance;
}

declare global {
  interface Window {
    daum?: {
      Postcode?: DaumPostcodeConstructor;
    };
  }
}

const DAUM_POSTCODE_ORIGIN = "https://t1.daumcdn.net";
const DAUM_POSTCODE_PATH = "/mapjsapi/bundle/postcode/prod/postcode.v2.js";
export const DAUM_POSTCODE_SCRIPT_SRC = `${DAUM_POSTCODE_ORIGIN}${DAUM_POSTCODE_PATH}`;
const DAUM_POSTCODE_SCRIPT_MARKER = "daum-postcode-v2";
export const DAUM_POSTCODE_READINESS_TIMEOUT_MS = 8000;

interface DaumLoadAttempt {
  fail: (error: IntegrationError) => void;
  promise: Promise<void>;
  script: HTMLScriptElement;
}

let activeAttempt: DaumLoadAttempt | null = null;

const unavailableError = (code: IntegrationErrorCode) =>
  new IntegrationError({
    code,
    integration: "daum-postcode",
    message: "Daum postcode runtime is unavailable.",
    retryable: true,
  });

const isDaumPostcodeReady = () =>
  typeof window !== "undefined" && typeof window.daum?.Postcode === "function";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const requiredResultFields = [
  "zonecode",
  "address",
  "addressEnglish",
  "addressType",
  "bname",
  "buildingName",
  "apartment",
  "sido",
  "sigungu",
  "sigunguCode",
  "bcode",
  "roadname",
  "roadnameCode",
  "jibunAddress",
] as const;

const parseDaumPostcodeResult = (value: unknown): DaumPostcodeResult | null => {
  if (
    !isRecord(value) ||
    requiredResultFields.some((field) => typeof value[field] !== "string") ||
    (value.roadAddress !== undefined && typeof value.roadAddress !== "string")
  ) {
    return null;
  }

  return {
    zonecode: value.zonecode as string,
    address: value.address as string,
    addressEnglish: value.addressEnglish as string,
    addressType: value.addressType as string,
    bname: value.bname as string,
    buildingName: value.buildingName as string,
    apartment: value.apartment as string,
    sido: value.sido as string,
    sigungu: value.sigungu as string,
    sigunguCode: value.sigunguCode as string,
    bcode: value.bcode as string,
    roadname: value.roadname as string,
    roadnameCode: value.roadnameCode as string,
    jibunAddress: value.jibunAddress as string,
    ...(value.roadAddress === undefined
      ? {}
      : { roadAddress: value.roadAddress as string }),
  };
};

const isExactDaumScript = (script: HTMLScriptElement) => {
  try {
    const url = new URL(script.src);

    return (
      url.origin === DAUM_POSTCODE_ORIGIN &&
      url.pathname === DAUM_POSTCODE_PATH &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
};

const getDaumPostcodeScripts = () =>
  typeof document === "undefined"
    ? []
    : Array.from(
        document.querySelectorAll<HTMLScriptElement>("script[src]"),
      ).filter(isExactDaumScript);

const createLoadAttempt = (script: HTMLScriptElement): DaumLoadAttempt => {
  let resolvePromise!: () => void;
  let rejectPromise!: (error: IntegrationError) => void;
  let timeout: number | null = null;
  let settled = false;
  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const cleanup = () => {
    script.removeEventListener("load", handleLoad);
    script.removeEventListener("error", handleError);
    if (timeout !== null) {
      window.clearTimeout(timeout);
      timeout = null;
    }
  };

  const succeed = () => {
    if (settled || !isDaumPostcodeReady()) return false;

    settled = true;
    cleanup();
    activeAttempt = null;
    resolvePromise();
    return true;
  };

  const fail = (error: IntegrationError) => {
    if (settled) return;

    settled = true;
    cleanup();
    if (script.isConnected) script.remove();
    activeAttempt = null;
    rejectPromise(error);
  };

  function handleLoad() {
    if (!succeed()) {
      fail(unavailableError("INTEGRATION_INVALID_RUNTIME"));
    }
  }

  function handleError() {
    fail(unavailableError("INTEGRATION_LOAD_FAILED"));
  }

  script.addEventListener("load", handleLoad);
  script.addEventListener("error", handleError);
  timeout = window.setTimeout(() => {
    if (!succeed()) fail(unavailableError("INTEGRATION_TIMEOUT"));
  }, DAUM_POSTCODE_READINESS_TIMEOUT_MS);

  return { fail, promise, script };
};

export const ensureDaumPostcodeScript = (): Promise<void> => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(unavailableError("INTEGRATION_UNAVAILABLE"));
  }
  if (isDaumPostcodeReady()) {
    getDaumPostcodeScripts()
      .slice(1)
      .forEach((script) => script.remove());
    return Promise.resolve();
  }

  if (activeAttempt) {
    if (activeAttempt.script.isConnected) {
      getDaumPostcodeScripts().forEach((script) => {
        if (script !== activeAttempt?.script) script.remove();
      });
      return activeAttempt.promise;
    }

    activeAttempt.fail(unavailableError("INTEGRATION_DISCONNECTED"));
  }

  // Static/pre-existing copies have unknown lifecycle state. A lazy adapter
  // owns exactly one known script and can therefore retry deterministically.
  getDaumPostcodeScripts().forEach((script) => script.remove());

  const script = document.createElement("script");
  script.src = DAUM_POSTCODE_SCRIPT_SRC;
  script.async = true;
  script.dataset.airbobIntegration = DAUM_POSTCODE_SCRIPT_MARKER;

  const attempt = createLoadAttempt(script);
  activeAttempt = attempt;
  document.head.appendChild(script);

  return attempt.promise;
};

export const openDaumPostcode = async (
  onComplete: (result: DaumPostcodeResult) => void,
  onError?: (error: IntegrationError) => void,
  signal?: AbortSignal,
): Promise<void> => {
  if (signal?.aborted) return;

  await ensureDaumPostcodeScript();
  if (signal?.aborted) return;

  const Postcode = window.daum?.Postcode;
  if (typeof Postcode !== "function") {
    throw unavailableError("INTEGRATION_INVALID_RUNTIME");
  }

  try {
    const postcode = new Postcode({
      oncomplete: (rawResult) => {
        if (signal?.aborted) return;

        const result = parseDaumPostcodeResult(rawResult);
        if (!result) {
          onError?.(unavailableError("INTEGRATION_INVALID_RUNTIME"));
          return;
        }

        onComplete(result);
      },
      width: "100%",
      height: "100%",
    });

    if (!postcode || typeof postcode.open !== "function") {
      throw unavailableError("INTEGRATION_INVALID_RUNTIME");
    }

    if (signal?.aborted) return;
    postcode.open();
  } catch (error) {
    if (error instanceof IntegrationError) throw error;
    throw unavailableError("INTEGRATION_INVALID_RUNTIME");
  }
};
