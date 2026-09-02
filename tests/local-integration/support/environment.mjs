const LOCAL_APP_ORIGIN = "http://127.0.0.1:4174";
const DEFAULT_BACKEND_ORIGIN = "http://127.0.0.1:8080";
const DEFAULT_BACKEND_READINESS_PATH = "/actuator/health/readiness";

export const LOCAL_INTEGRATION_APP_ORIGIN = LOCAL_APP_ORIGIN;
export const LOCAL_INTEGRATION_VITE_PORT = 4174;
export const LOCAL_INTEGRATION_PROJECTS = Object.freeze({
  core: "local-core",
  toss: "local-toss-sandbox",
});

export const LOCAL_INTEGRATION_ENV_KEYS = Object.freeze({
  activeProject: "AIRBOB_LOCAL_ACTIVE_PROJECT",
  backendOrigin: "AIRBOB_LOCAL_BACKEND_ORIGIN",
  backendRevision: "AIRBOB_LOCAL_BACKEND_REVISION",
  backendReadinessPath: "AIRBOB_LOCAL_BACKEND_READINESS_PATH",
  cacheRedisPort: "AIRBOB_LOCAL_CACHE_REDIS_PORT",
  complimentaryCouponId: "AIRBOB_LOCAL_COMPLIMENTARY_COUPON_ID",
  complimentaryFixture: "AIRBOB_LOCAL_COMPLIMENTARY_FIXTURE",
  dataOwnershipProfile: "AIRBOB_LOCAL_DATA_OWNERSHIP_PROFILE",
  debeziumPort: "AIRBOB_LOCAL_DEBEZIUM_PORT",
  elasticsearchPort: "AIRBOB_LOCAL_ELASTICSEARCH_PORT",
  kafkaPort: "AIRBOB_LOCAL_KAFKA_PORT",
  mutationProfile: "AIRBOB_LOCAL_MUTATION_PROFILE",
  mysqlPort: "AIRBOB_LOCAL_MYSQL_PORT",
  paidFixtures: "AIRBOB_LOCAL_PAID_FIXTURES",
  qaEmail: "AIRBOB_QA_EMAIL",
  qaPassword: "AIRBOB_QA_PASSWORD",
  readinessComponents: "AIRBOB_LOCAL_REQUIRED_HEALTH_COMPONENTS",
  redisPort: "AIRBOB_LOCAL_REDIS_PORT",
  resetAuthorizedAt: "AIRBOB_LOCAL_RESET_AUTHORIZED_AT",
  resetOwnerLabel: "AIRBOB_LOCAL_RESET_OWNER_LABEL",
  resetProcedureLabel: "AIRBOB_LOCAL_RESET_PROCEDURE_LABEL",
  runId: "AIRBOB_LOCAL_RUN_ID",
  searchDestination: "AIRBOB_LOCAL_SEARCH_DESTINATION",
  tossFailureProfile: "AIRBOB_LOCAL_TOSS_FAILURE_PROFILE",
  tossExpectedFailureCode: "AIRBOB_LOCAL_TOSS_EXPECTED_FAILURE_CODE",
  tossCardCvc: "AIRBOB_LOCAL_TOSS_CARD_CVC",
  tossCardExpiry: "AIRBOB_LOCAL_TOSS_CARD_EXPIRY",
  tossCardNumber: "AIRBOB_LOCAL_TOSS_CARD_NUMBER",
  tossCardPassword: "AIRBOB_LOCAL_TOSS_CARD_PASSWORD",
  tossClientKey: "REACT_APP_TOSS_CLIENT_KEY",
  tossProviderProfile: "AIRBOB_LOCAL_TOSS_PROVIDER_PROFILE",
  tossSandboxProfile: "AIRBOB_LOCAL_TOSS_SANDBOX_PROFILE",
  tossServerProfile: "AIRBOB_LOCAL_TOSS_SERVER_PROFILE",
  wishlistAccommodationId: "AIRBOB_LOCAL_WISHLIST_ACCOMMODATION_ID",
});

const PRIVATE_RUNNER_ENV_KEYS = Object.freeze([
  LOCAL_INTEGRATION_ENV_KEYS.activeProject,
  LOCAL_INTEGRATION_ENV_KEYS.backendRevision,
  LOCAL_INTEGRATION_ENV_KEYS.complimentaryCouponId,
  LOCAL_INTEGRATION_ENV_KEYS.complimentaryFixture,
  LOCAL_INTEGRATION_ENV_KEYS.dataOwnershipProfile,
  LOCAL_INTEGRATION_ENV_KEYS.mutationProfile,
  LOCAL_INTEGRATION_ENV_KEYS.paidFixtures,
  LOCAL_INTEGRATION_ENV_KEYS.qaEmail,
  LOCAL_INTEGRATION_ENV_KEYS.qaPassword,
  LOCAL_INTEGRATION_ENV_KEYS.resetAuthorizedAt,
  LOCAL_INTEGRATION_ENV_KEYS.resetOwnerLabel,
  LOCAL_INTEGRATION_ENV_KEYS.resetProcedureLabel,
  LOCAL_INTEGRATION_ENV_KEYS.runId,
  LOCAL_INTEGRATION_ENV_KEYS.searchDestination,
  LOCAL_INTEGRATION_ENV_KEYS.tossFailureProfile,
  LOCAL_INTEGRATION_ENV_KEYS.tossExpectedFailureCode,
  LOCAL_INTEGRATION_ENV_KEYS.tossCardCvc,
  LOCAL_INTEGRATION_ENV_KEYS.tossCardExpiry,
  LOCAL_INTEGRATION_ENV_KEYS.tossCardNumber,
  LOCAL_INTEGRATION_ENV_KEYS.tossCardPassword,
  LOCAL_INTEGRATION_ENV_KEYS.tossProviderProfile,
  LOCAL_INTEGRATION_ENV_KEYS.tossSandboxProfile,
  LOCAL_INTEGRATION_ENV_KEYS.tossServerProfile,
  LOCAL_INTEGRATION_ENV_KEYS.wishlistAccommodationId,
]);

const PROHIBITED_RUNNER_ENV_KEYS = Object.freeze([
  "AIRBOB_LOCAL_TOSS_SECRET_KEY",
  "TOSS_SECRET_KEY",
]);

const TOSS_ONLY_RUNNER_ENV_KEYS = Object.freeze([
  LOCAL_INTEGRATION_ENV_KEYS.tossFailureProfile,
  LOCAL_INTEGRATION_ENV_KEYS.tossExpectedFailureCode,
  LOCAL_INTEGRATION_ENV_KEYS.tossCardCvc,
  LOCAL_INTEGRATION_ENV_KEYS.tossCardExpiry,
  LOCAL_INTEGRATION_ENV_KEYS.tossCardNumber,
  LOCAL_INTEGRATION_ENV_KEYS.tossCardPassword,
  LOCAL_INTEGRATION_ENV_KEYS.tossClientKey,
  LOCAL_INTEGRATION_ENV_KEYS.tossProviderProfile,
  LOCAL_INTEGRATION_ENV_KEYS.tossSandboxProfile,
  LOCAL_INTEGRATION_ENV_KEYS.tossServerProfile,
]);

const PLAYWRIGHT_RUNTIME_ENV_KEYS = Object.freeze([
  "CI",
  "FORCE_COLOR",
  "HOME",
  "LANG",
  "LC_ALL",
  "LOGNAME",
  "NO_COLOR",
  "PATH",
  "PLAYWRIGHT_BROWSERS_PATH",
  "SHELL",
  "SSL_CERT_DIR",
  "SSL_CERT_FILE",
  "TERM",
  "TMP",
  "TMPDIR",
  "TZ",
  "USER",
]);

const DEFAULT_READINESS_PORTS = Object.freeze({
  mysql: 3307,
  redis: 6379,
  cacheRedis: 6380,
  elasticsearch: 9200,
  kafka: 9092,
  debezium: 8083,
});

const ALLOWED_READINESS_COMPONENTS = Object.freeze(["accommodationInventory"]);

const BACKEND_REVISION_PATTERN = /^[0-9a-f]{7,40}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_INSTANT_PATTERN =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2})(?:\.(\d{3}))?)?Z$/;
const RESET_PROCEDURE_LABEL_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RUN_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOSS_CLIENT_KEY_PATTERN = /^test_ck_[A-Za-z0-9_-]{1,256}$/;
const TOSS_FAILURE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;
const RESET_AUTHORIZATION_MAX_AGE_MS = 15 * 60 * 1_000;
const RESET_AUTHORIZATION_MAX_FUTURE_SKEW_MS = 30 * 1_000;

export class LocalIntegrationBlockedError extends Error {
  constructor(reason) {
    super(`Local integration BLOCKED / UNVERIFIED: ${reason}.`);
    this.name = "LocalIntegrationBlockedError";
  }
}

const blocked = (reason) => {
  throw new LocalIntegrationBlockedError(reason);
};

const containsAsciiControl = (value) =>
  Array.from(value).some((character) => {
    const codePoint = character.charCodeAt(0);
    return codePoint <= 31 || codePoint === 127;
  });

const readRequired = (environment, key) => {
  const rawValue = environment[key];
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    blocked(`missing ${key}`);
  }

  if (rawValue !== rawValue.trim() || containsAsciiControl(rawValue)) {
    blocked(`invalid ${key}`);
  }

  return rawValue;
};

const readOptional = (environment, key) => {
  const rawValue = environment[key];
  if (rawValue === undefined || rawValue === "") return null;
  return readRequired(environment, key);
};

const parsePositiveInteger = (value, key) => {
  if (!/^\d+$/.test(value)) blocked(`invalid ${key}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) blocked(`invalid ${key}`);
  return parsed;
};

const parsePort = (environment, key, fallback) => {
  const configured = readOptional(environment, key);
  const port =
    configured === null ? fallback : parsePositiveInteger(configured, key);
  if (port > 65_535) blocked(`invalid ${key}`);
  return port;
};

const parseIsoDate = (value, key) => {
  if (!DATE_PATTERN.test(value)) blocked(`invalid ${key}`);
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== value
  ) {
    blocked(`invalid ${key}`);
  }
  return value;
};

const parseFreshAuthorizationTimestamp = (environment, key, now) => {
  const value = readRequired(environment, key);
  const match = ISO_INSTANT_PATTERN.exec(value);
  if (match === null) {
    blocked(`invalid ${key}`);
  }
  const normalized = `${match[1]}:${match[2] ?? "00"}.${match[3] ?? "000"}Z`;
  const timestamp = Date.parse(normalized);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString() !== normalized
  ) {
    blocked(`invalid ${key}`);
  }

  const age = now - timestamp;
  if (
    age > RESET_AUTHORIZATION_MAX_AGE_MS ||
    age < -RESET_AUTHORIZATION_MAX_FUTURE_SKEW_MS
  ) {
    blocked(`invalid ${key}`);
  }
  return value;
};

const parseJson = (environment, key) => {
  const value = readRequired(environment, key);
  try {
    return JSON.parse(value);
  } catch {
    blocked(`invalid ${key}`);
  }
};

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasExactKeys = (value, keys) => {
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index])
  );
};

const parseAccommodationFixture = (value, key) => {
  const expectedKeys = ["accommodationId", "checkIn", "checkOut"];
  if (!isPlainObject(value) || !hasExactKeys(value, expectedKeys)) {
    blocked(`invalid ${key}`);
  }

  if (
    typeof value.accommodationId !== "string" ||
    typeof value.checkIn !== "string" ||
    typeof value.checkOut !== "string"
  ) {
    blocked(`invalid ${key}`);
  }

  const accommodationId = parsePositiveInteger(value.accommodationId, key);
  const checkIn = parseIsoDate(value.checkIn, key);
  const checkOut = parseIsoDate(value.checkOut, key);
  if (checkIn >= checkOut) blocked(`invalid ${key}`);

  return Object.freeze({ accommodationId, checkIn, checkOut });
};

const parsePaidFixtures = (environment) => {
  const key = LOCAL_INTEGRATION_ENV_KEYS.paidFixtures;
  const value = parseJson(environment, key);
  if (!Array.isArray(value) || value.length !== 3) blocked(`invalid ${key}`);

  const fixtures = value.map((fixture) =>
    parseAccommodationFixture(fixture, key),
  );
  const identities = fixtures.map(
    ({ accommodationId, checkIn, checkOut }) =>
      `${accommodationId}:${checkIn}:${checkOut}`,
  );
  if (new Set(identities).size !== identities.length) blocked(`invalid ${key}`);

  return Object.freeze(fixtures);
};

const assertIndependentStayFixtures = (fixtures) => {
  fixtures.forEach((fixture, index) => {
    fixtures.slice(index + 1).forEach((candidate) => {
      const sharesAccommodation =
        fixture.accommodationId === candidate.accommodationId;
      const datesOverlap =
        fixture.checkIn < candidate.checkOut &&
        candidate.checkIn < fixture.checkOut;
      if (sharesAccommodation && datesOverlap) {
        blocked("overlapping local stay fixtures");
      }
    });
  });
};

const parseBackendOrigin = (environment) => {
  const key = LOCAL_INTEGRATION_ENV_KEYS.backendOrigin;
  const rawValue = readOptional(environment, key) ?? DEFAULT_BACKEND_ORIGIN;
  try {
    const url = new URL(rawValue);
    if (
      url.protocol !== "http:" ||
      (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") ||
      url.port !== "8080" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      blocked(`invalid ${key}`);
    }
    return url.origin;
  } catch (error) {
    if (error instanceof LocalIntegrationBlockedError) throw error;
    blocked(`invalid ${key}`);
  }
};

const parseReadinessPath = (environment) => {
  const key = LOCAL_INTEGRATION_ENV_KEYS.backendReadinessPath;
  const value =
    readOptional(environment, key) ?? DEFAULT_BACKEND_READINESS_PATH;
  if (!/^\/actuator\/[A-Za-z0-9/_-]*$/.test(value) || value.includes("//")) {
    blocked(`invalid ${key}`);
  }
  return value;
};

const parseReadinessComponents = (environment) => {
  const key = LOCAL_INTEGRATION_ENV_KEYS.readinessComponents;
  const configured = readOptional(environment, key);
  const components = configured
    ? configured.split(",").map((component) => component.trim())
    : [...ALLOWED_READINESS_COMPONENTS];

  if (
    components.length === 0 ||
    components.some(
      (component) =>
        !ALLOWED_READINESS_COMPONENTS.includes(component) || !component,
    ) ||
    new Set(components).size !== components.length
  ) {
    blocked(`invalid ${key}`);
  }

  return Object.freeze(components);
};

const parseTossSandbox = (environment, requireToss) => {
  if (!requireToss) return null;

  const profileKey = LOCAL_INTEGRATION_ENV_KEYS.tossSandboxProfile;
  if (readRequired(environment, profileKey) !== "enabled") {
    blocked(`invalid ${profileKey}`);
  }

  const clientKeyName = LOCAL_INTEGRATION_ENV_KEYS.tossClientKey;
  const clientKey = readRequired(environment, clientKeyName);
  if (!TOSS_CLIENT_KEY_PATTERN.test(clientKey)) {
    blocked(`invalid ${clientKeyName}`);
  }

  const serverProfileKey = LOCAL_INTEGRATION_ENV_KEYS.tossServerProfile;
  if (readRequired(environment, serverProfileKey) !== "sandbox-configured") {
    blocked(`invalid ${serverProfileKey}`);
  }

  const failureProfileKey = LOCAL_INTEGRATION_ENV_KEYS.tossFailureProfile;
  if (
    readRequired(environment, failureProfileKey) !==
    "confirm-test-code-configured"
  ) {
    blocked(`invalid ${failureProfileKey}`);
  }

  const expectedFailureCodeKey =
    LOCAL_INTEGRATION_ENV_KEYS.tossExpectedFailureCode;
  const expectedFailureCode = readRequired(environment, expectedFailureCodeKey);
  if (!TOSS_FAILURE_CODE_PATTERN.test(expectedFailureCode)) {
    blocked(`invalid ${expectedFailureCodeKey}`);
  }

  const provider = Object.freeze({
    cardNumber: readRequired(
      environment,
      LOCAL_INTEGRATION_ENV_KEYS.tossCardNumber,
    ),
    expiry: readRequired(
      environment,
      LOCAL_INTEGRATION_ENV_KEYS.tossCardExpiry,
    ),
    cvc: readRequired(environment, LOCAL_INTEGRATION_ENV_KEYS.tossCardCvc),
    password: readRequired(
      environment,
      LOCAL_INTEGRATION_ENV_KEYS.tossCardPassword,
    ),
    testOnly: true,
  });

  const providerProfileKey = LOCAL_INTEGRATION_ENV_KEYS.tossProviderProfile;
  if (readRequired(environment, providerProfileKey) !== "sandbox-test-only") {
    blocked(`invalid ${providerProfileKey}`);
  }

  if (!/^\d{12,19}$/.test(provider.cardNumber)) {
    blocked(`invalid ${LOCAL_INTEGRATION_ENV_KEYS.tossCardNumber}`);
  }
  if (!/^\d{2}\/\d{2}$/.test(provider.expiry)) {
    blocked(`invalid ${LOCAL_INTEGRATION_ENV_KEYS.tossCardExpiry}`);
  }
  if (!/^\d{3,4}$/.test(provider.cvc)) {
    blocked(`invalid ${LOCAL_INTEGRATION_ENV_KEYS.tossCardCvc}`);
  }
  if (!/^\d{2}$/.test(provider.password)) {
    blocked(`invalid ${LOCAL_INTEGRATION_ENV_KEYS.tossCardPassword}`);
  }

  return Object.freeze({
    runToss: true,
    clientKeyPresent: true,
    expectedFailureCode,
    failureProfileConfigured: true,
    provider,
  });
};

/**
 * Parse only the local-integration allowlist. Values never appear in errors,
 * and no ambient environment object is retained or returned.
 */
export const loadLocalIntegrationEnvironment = ({
  environment = process.env,
  expectedProject = /** @type {null | string} */ (null),
  now = () => new Date(),
  requireRunnerIdentity = false,
  requireToss = false,
} = {}) => {
  const prohibitedKey = PROHIBITED_RUNNER_ENV_KEYS.find((key) =>
    Object.hasOwn(environment, key),
  );
  if (prohibitedKey) blocked(`prohibited ${prohibitedKey}`);

  const mutationProfileKey = LOCAL_INTEGRATION_ENV_KEYS.mutationProfile;
  if (readRequired(environment, mutationProfileKey) !== "disposable") {
    blocked(`invalid ${mutationProfileKey}`);
  }

  const dataOwnershipProfileKey =
    LOCAL_INTEGRATION_ENV_KEYS.dataOwnershipProfile;
  if (
    readRequired(environment, dataOwnershipProfileKey) !==
    "backend-owned-disposable"
  ) {
    blocked(`invalid ${dataOwnershipProfileKey}`);
  }

  let runner = null;
  if (requireRunnerIdentity) {
    const activeProject = readRequired(
      environment,
      LOCAL_INTEGRATION_ENV_KEYS.activeProject,
    );
    if (
      !Object.values(LOCAL_INTEGRATION_PROJECTS).includes(activeProject) ||
      (expectedProject !== null && activeProject !== expectedProject)
    ) {
      blocked(`invalid ${LOCAL_INTEGRATION_ENV_KEYS.activeProject}`);
    }
    const runId = readRequired(environment, LOCAL_INTEGRATION_ENV_KEYS.runId);
    if (!RUN_ID_PATTERN.test(runId)) {
      blocked(`invalid ${LOCAL_INTEGRATION_ENV_KEYS.runId}`);
    }
    runner = Object.freeze({ activeProject, runId });
  }

  const currentTime = now();
  if (
    !(currentTime instanceof Date) ||
    !Number.isFinite(currentTime.getTime())
  ) {
    blocked("invalid local reset authorization clock");
  }

  const backendRevisionKey = LOCAL_INTEGRATION_ENV_KEYS.backendRevision;
  const backendRevision = readRequired(environment, backendRevisionKey);
  if (!BACKEND_REVISION_PATTERN.test(backendRevision)) {
    blocked(`invalid ${backendRevisionKey}`);
  }
  const resetOwnerLabelKey = LOCAL_INTEGRATION_ENV_KEYS.resetOwnerLabel;
  const resetOwnerLabel = readRequired(environment, resetOwnerLabelKey);
  if (resetOwnerLabel !== "backend-local-owner") {
    blocked(`invalid ${resetOwnerLabelKey}`);
  }
  const resetProcedureLabelKey = LOCAL_INTEGRATION_ENV_KEYS.resetProcedureLabel;
  const resetProcedureLabel = readRequired(environment, resetProcedureLabelKey);
  if (
    resetProcedureLabel.length > 64 ||
    !RESET_PROCEDURE_LABEL_PATTERN.test(resetProcedureLabel)
  ) {
    blocked(`invalid ${resetProcedureLabelKey}`);
  }
  const resetAuthorization = Object.freeze({
    authorizedAt: parseFreshAuthorizationTimestamp(
      environment,
      LOCAL_INTEGRATION_ENV_KEYS.resetAuthorizedAt,
      currentTime.getTime(),
    ),
    ownerLabel: resetOwnerLabel,
    procedureLabel: resetProcedureLabel,
  });

  const qaEmailKey = LOCAL_INTEGRATION_ENV_KEYS.qaEmail;
  const qaEmail = readRequired(environment, qaEmailKey);
  if (!EMAIL_PATTERN.test(qaEmail)) blocked(`invalid ${qaEmailKey}`);

  const qaPasswordKey = LOCAL_INTEGRATION_ENV_KEYS.qaPassword;
  const qaPassword = readRequired(environment, qaPasswordKey);
  if (qaPassword.length < 8 || qaPassword.length > 256) {
    blocked(`invalid ${qaPasswordKey}`);
  }

  const searchDestinationKey = LOCAL_INTEGRATION_ENV_KEYS.searchDestination;
  const searchDestination = readRequired(environment, searchDestinationKey);
  if (searchDestination.length > 100)
    blocked(`invalid ${searchDestinationKey}`);

  const wishlistIdKey = LOCAL_INTEGRATION_ENV_KEYS.wishlistAccommodationId;
  const wishlistAccommodationId = parsePositiveInteger(
    readRequired(environment, wishlistIdKey),
    wishlistIdKey,
  );

  const backendOrigin = parseBackendOrigin(environment);
  const backendReadinessPath = parseReadinessPath(environment);
  const paidFixtures = parsePaidFixtures(environment);
  const complimentaryFixture = Object.freeze({
    ...parseAccommodationFixture(
      parseJson(environment, LOCAL_INTEGRATION_ENV_KEYS.complimentaryFixture),
      LOCAL_INTEGRATION_ENV_KEYS.complimentaryFixture,
    ),
    couponId: parsePositiveInteger(
      readRequired(
        environment,
        LOCAL_INTEGRATION_ENV_KEYS.complimentaryCouponId,
      ),
      LOCAL_INTEGRATION_ENV_KEYS.complimentaryCouponId,
    ),
  });
  assertIndependentStayFixtures([...paidFixtures, complimentaryFixture]);

  return Object.freeze({
    appOrigin: LOCAL_APP_ORIGIN,
    backend: Object.freeze({
      origin: backendOrigin,
      revision: backendRevision,
      readinessUrl: `${backendOrigin}${backendReadinessPath}`,
      allowAggregateOnlyReadiness:
        backendReadinessPath === DEFAULT_BACKEND_READINESS_PATH,
      requiredHealthComponents: parseReadinessComponents(environment),
      ports: Object.freeze({
        mysql: parsePort(
          environment,
          LOCAL_INTEGRATION_ENV_KEYS.mysqlPort,
          DEFAULT_READINESS_PORTS.mysql,
        ),
        redis: parsePort(
          environment,
          LOCAL_INTEGRATION_ENV_KEYS.redisPort,
          DEFAULT_READINESS_PORTS.redis,
        ),
        cacheRedis: parsePort(
          environment,
          LOCAL_INTEGRATION_ENV_KEYS.cacheRedisPort,
          DEFAULT_READINESS_PORTS.cacheRedis,
        ),
        elasticsearch: parsePort(
          environment,
          LOCAL_INTEGRATION_ENV_KEYS.elasticsearchPort,
          DEFAULT_READINESS_PORTS.elasticsearch,
        ),
        kafka: parsePort(
          environment,
          LOCAL_INTEGRATION_ENV_KEYS.kafkaPort,
          DEFAULT_READINESS_PORTS.kafka,
        ),
        debezium: parsePort(
          environment,
          LOCAL_INTEGRATION_ENV_KEYS.debeziumPort,
          DEFAULT_READINESS_PORTS.debezium,
        ),
      }),
    }),
    mutationProfile: "disposable",
    dataOwnershipProfile: "backend-owned-disposable",
    runner,
    resetAuthorization,
    credentials: Object.freeze({ email: qaEmail, password: qaPassword }),
    fixtures: Object.freeze({
      searchDestination,
      wishlistAccommodationId,
      paid: paidFixtures,
      complimentary: complimentaryFixture,
    }),
    toss: parseTossSandbox(environment, requireToss),
  });
};

/**
 * Values passed to Vite are explicit browser-public inputs. Runner-only
 * values are overwritten so Playwright's inherited environment cannot expose
 * them to the frontend process.
 */
export const createLocalViteEnvironment = (environment = process.env) => {
  const prohibitedKey = PROHIBITED_RUNNER_ENV_KEYS.find((key) =>
    Object.hasOwn(environment, key),
  );
  if (prohibitedKey) blocked(`prohibited ${prohibitedKey}`);

  const clientKey = environment[LOCAL_INTEGRATION_ENV_KEYS.tossClientKey] ?? "";
  if (/^(?:live|test)_sk_/.test(clientKey)) {
    blocked(`invalid ${LOCAL_INTEGRATION_ENV_KEYS.tossClientKey}`);
  }
  const activeProject = environment[LOCAL_INTEGRATION_ENV_KEYS.activeProject];
  const tossClientKey =
    activeProject === LOCAL_INTEGRATION_PROJECTS.toss ? clientKey : "";
  if (
    activeProject === LOCAL_INTEGRATION_PROJECTS.toss &&
    !TOSS_CLIENT_KEY_PATTERN.test(tossClientKey)
  ) {
    blocked(`invalid ${LOCAL_INTEGRATION_ENV_KEYS.tossClientKey}`);
  }

  return {
    BROWSER: "none",
    ...Object.fromEntries(PRIVATE_RUNNER_ENV_KEYS.map((key) => [key, ""])),
    REACT_APP_API_URL: "http://127.0.0.1:8080",
    REACT_APP_CLOUDFRONT_DOMAIN: "",
    REACT_APP_GOOGLE_MAPS_API_KEY: "",
    REACT_APP_TOSS_CLIENT_KEY: tossClientKey,
  };
};

/**
 * The browser runner receives only its declared local profile and non-secret
 * process runtime inputs. Ambient cloud, database, package-registry, and
 * developer credentials never cross into the Playwright worker.
 */
export const createLocalPlaywrightEnvironment = (
  environment = process.env,
  overrides = {},
) => {
  const activeProject =
    overrides[LOCAL_INTEGRATION_ENV_KEYS.activeProject] ??
    environment[LOCAL_INTEGRATION_ENV_KEYS.activeProject];
  const allowedKeys = [
    ...PLAYWRIGHT_RUNTIME_ENV_KEYS,
    ...Object.values(LOCAL_INTEGRATION_ENV_KEYS),
  ];
  return Object.freeze(
    Object.fromEntries(
      allowedKeys.flatMap((key) => {
        if (
          activeProject !== LOCAL_INTEGRATION_PROJECTS.toss &&
          TOSS_ONLY_RUNNER_ENV_KEYS.includes(key)
        ) {
          return [];
        }
        const value = overrides[key] ?? environment[key];
        return typeof value === "string" ? [[key, value]] : [];
      }),
    ),
  );
};
