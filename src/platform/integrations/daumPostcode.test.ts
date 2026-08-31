import {
  DAUM_POSTCODE_READINESS_TIMEOUT_MS,
  DAUM_POSTCODE_SCRIPT_SRC,
  ensureDaumPostcodeScript,
  openDaumPostcode,
} from "./daumPostcode";

const daumScripts = () =>
  Array.from(document.scripts).filter(
    (script) => script.src === DAUM_POSTCODE_SCRIPT_SRC,
  );

const requireDaumScript = (): HTMLScriptElement => {
  const script = daumScripts().at(0);
  if (!script) throw new Error("Expected the Daum postcode script");
  return script;
};

const installDaumRuntime = () => {
  const open = vi.fn();
  let oncomplete: ((value: unknown) => void) | null = null;
  const Postcode = vi.fn(function Postcode(options) {
    oncomplete = options.oncomplete;
    return {
      embed: vi.fn(),
      open,
    };
  });
  window.daum = { Postcode: Postcode as any };

  return { getOncomplete: () => oncomplete, open, Postcode };
};

const validPostcodeResult = {
  zonecode: "06236",
  address: "서울특별시 강남구 테헤란로 123",
  addressEnglish: "",
  addressType: "R",
  bname: "",
  buildingName: "",
  apartment: "",
  sido: "서울특별시",
  sigungu: "강남구",
  sigunguCode: "",
  bcode: "",
  roadname: "테헤란로",
  roadnameCode: "",
  jibunAddress: "",
  roadAddress: "서울특별시 강남구 테헤란로 123",
};

describe("Daum postcode platform integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    delete window.daum;
    daumScripts().forEach((script) => script.remove());
  });

  afterEach(() => {
    daumScripts().forEach((script) => script.dispatchEvent(new Event("error")));
    daumScripts().forEach((script) => script.remove());
    delete window.daum;
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("loads one exact marked HTTPS script and shares the pending promise", async () => {
    const first = ensureDaumPostcodeScript();
    const second = ensureDaumPostcodeScript();
    const script = requireDaumScript();

    expect(second).toBe(first);
    expect(daumScripts()).toHaveLength(1);
    expect(script.src).toBe(DAUM_POSTCODE_SCRIPT_SRC);
    expect(script.dataset.airbobIntegration).toBe("daum-postcode-v2");

    installDaumRuntime();
    script.dispatchEvent(new Event("load"));
    await expect(first).resolves.toBeUndefined();
  });

  it("resolves without loading when the minimum runtime already exists", async () => {
    installDaumRuntime();

    await expect(ensureDaumPostcodeScript()).resolves.toBeUndefined();
    expect(daumScripts()).toHaveLength(0);
  });

  it("rejects an invalid runtime and retries with a fresh script", async () => {
    const invalidLoad = ensureDaumPostcodeScript();
    const invalidScript = requireDaumScript();
    invalidScript.dispatchEvent(new Event("load"));

    await expect(invalidLoad).rejects.toMatchObject({
      code: "INTEGRATION_INVALID_RUNTIME",
    });
    expect(invalidScript.isConnected).toBe(false);

    const retry = ensureDaumPostcodeScript();
    const retryScript = requireDaumScript();
    installDaumRuntime();
    retryScript.dispatchEvent(new Event("load"));
    await expect(retry).resolves.toBeUndefined();
  });

  it("removes a failed script and permits retry", async () => {
    const failedLoad = ensureDaumPostcodeScript();
    const failedScript = requireDaumScript();
    failedScript.dispatchEvent(new Event("error"));

    await expect(failedLoad).rejects.toMatchObject({
      code: "INTEGRATION_LOAD_FAILED",
    });
    expect(failedScript.isConnected).toBe(false);
  });

  it("bounds readiness and returns only safe typed failure metadata", async () => {
    const loading = ensureDaumPostcodeScript();

    vi.advanceTimersByTime(DAUM_POSTCODE_READINESS_TIMEOUT_MS);

    await expect(loading).rejects.toEqual(
      expect.objectContaining({
        code: "INTEGRATION_TIMEOUT",
        integration: "daum-postcode",
        message: "Daum postcode runtime is unavailable.",
      }),
    );
    expect(daumScripts()).toHaveLength(0);
  });

  it("opens the provider at full size with a typed completion callback", async () => {
    const { getOncomplete, open, Postcode } = installDaumRuntime();
    const onComplete = vi.fn();

    await openDaumPostcode(onComplete);

    expect(Postcode).toHaveBeenCalledWith(
      expect.objectContaining({
        oncomplete: expect.any(Function),
        width: "100%",
        height: "100%",
      }),
    );
    expect(open).toHaveBeenCalledTimes(1);

    getOncomplete()?.({ ...validPostcodeResult, ignoredProviderField: "drop-me" });
    expect(onComplete).toHaveBeenCalledWith(validPostcodeResult);
  });

  it("does not construct or open the provider after a pending load is aborted", async () => {
    const controller = new AbortController();
    const opening = openDaumPostcode(vi.fn(), vi.fn(), controller.signal);
    const script = requireDaumScript();
    controller.abort();
    const { open, Postcode } = installDaumRuntime();

    script.dispatchEvent(new Event("load"));

    await expect(opening).resolves.toBeUndefined();
    expect(Postcode).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("routes an invalid callback payload to typed onError without exposing it", async () => {
    const { getOncomplete } = installDaumRuntime();
    const onComplete = vi.fn();
    const onError = vi.fn();

    await openDaumPostcode(onComplete, onError);
    getOncomplete()?.({ zonecode: 6236, rawSecret: "must-not-propagate" });

    expect(onComplete).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "integration",
        code: "INTEGRATION_INVALID_RUNTIME",
        integration: "daum-postcode",
      }),
    );
    expect(JSON.stringify(onError.mock.calls)).not.toContain("must-not-propagate");
  });

  it("normalizes a throwing provider constructor without exposing its payload", async () => {
    window.daum = {
      Postcode: vi.fn(function Postcode() {
        throw new Error("raw provider payload must not escape");
      }) as any,
    };

    await expect(openDaumPostcode(vi.fn())).rejects.toEqual(
      expect.objectContaining({
        kind: "integration",
        code: "INTEGRATION_INVALID_RUNTIME",
        message: "Daum postcode runtime is unavailable.",
      }),
    );
  });
});
