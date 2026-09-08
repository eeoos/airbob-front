import {
  lstat,
  mkdir,
  mkdtemp,
  opendir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMMITTED_PRIVACY_CANARIES,
  findSensitiveTextViolations,
  normalizeSensitiveText,
  readRuntimeSensitiveValues,
  redactSensitiveText,
} from "./sensitive-text.mjs";
import {
  createRedactedLineWriter,
  RedactedLineReporter,
} from "./redacted-line-reporter.mjs";

const supportDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(supportDirectory, "../../..");
// Playwright clears outputDir before each run. The HTML reporter is disabled,
// so only the current run's owned directory is scanned; unrelated stale local
// reports are never deleted or treated as current evidence.
const artifactRoots = ["test-results"];
const allowedTextArtifactExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".log",
  ".md",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);
const ARTIFACT_QUARANTINE_MARKER =
  "[Playwright artifact quarantined by privacy policy.]\n";
const DEFAULT_ARTIFACT_LIMITS = Object.freeze({
  maxFileBytes: 2 * 1024 * 1024,
  maxFileCount: 512,
  maxTreeBytes: 16 * 1024 * 1024,
});

const readSelectedProjectNames = (argv = process.argv.slice(2)) => {
  const names = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--project") {
      const value = argv[index + 1];
      if (value) names.add(value);
      index += 1;
    } else if (argument?.startsWith("--project=")) {
      const value = argument.slice("--project=".length);
      if (value) names.add(value);
    }
  }

  return names;
};

export const findTextViolations = (
  text,
  { runtimeSensitiveValues = readRuntimeSensitiveValues() } = {},
) => {
  const normalizedText = normalizeSensitiveText(text);
  const violations = new Set(
    findSensitiveTextViolations(normalizedText, { runtimeSensitiveValues }),
  );

  COMMITTED_PRIVACY_CANARIES.forEach((canary, index) => {
    if (normalizedText.includes(canary)) {
      violations.add(`committed-canary-${index + 1}`);
    }
  });

  return [...violations].sort();
};

const artifactFiles = async function* (directory) {
  let entries;
  try {
    entries = await opendir(directory);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  for await (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      yield { path: entryPath, kind: "symbolic-link", size: 0 };
    } else if (entry.isDirectory()) {
      yield* artifactFiles(entryPath);
    } else if (entry.isFile()) {
      let stats;
      try {
        stats = await lstat(entryPath);
      } catch (error) {
        if (error && typeof error === "object" && error.code === "ENOENT") {
          continue;
        }
        throw error;
      }
      yield {
        path: entryPath,
        kind: stats.isFile() ? "file" : "unsafe-node",
        size: stats.size,
      };
    } else {
      yield { path: entryPath, kind: "unsafe-node", size: 0 };
    }
  }
};

const securelyReplaceTextArtifact = async (artifactPath, text) => {
  await rm(artifactPath, { force: true });
  await writeFile(artifactPath, text, { encoding: "utf8", flag: "wx" });
};

const quarantineTextArtifact = async (artifactPath) => {
  try {
    await securelyReplaceTextArtifact(artifactPath, ARTIFACT_QUARANTINE_MARKER);
    return "quarantined";
  } catch {
    await rm(artifactPath, { force: true });
    return "removed";
  }
};

const sanitizeTextArtifact = async (
  artifactPath,
  text,
  runtimeSensitiveValues,
) => {
  const violations = findTextViolations(text, { runtimeSensitiveValues });
  if (violations.length === 0) return null;

  const redacted = redactSensitiveText(text, { runtimeSensitiveValues });
  const residualViolations = findTextViolations(redacted, {
    runtimeSensitiveValues,
  });
  if (residualViolations.length === 0) {
    await securelyReplaceTextArtifact(artifactPath, redacted);
    return { action: "sanitized", violations };
  }

  const action = await quarantineTextArtifact(artifactPath);
  return {
    action,
    violations: [...new Set([...violations, ...residualViolations])],
  };
};

const scanArtifactDirectories = async (
  directories,
  {
    limits = DEFAULT_ARTIFACT_LIMITS,
    runtimeSensitiveValues = readRuntimeSensitiveValues(),
  } = {},
) => {
  const findings = [];
  let fileCount = 0;
  let treeBytes = 0;

  for (const absoluteRoot of directories) {
    for await (const artifact of artifactFiles(absoluteRoot)) {
      fileCount += 1;
      treeBytes += artifact.size;
      const relativePath = path.relative(projectRoot, artifact.path);

      if (artifact.kind === "symbolic-link") {
        await rm(artifact.path, { force: true });
        findings.push(`${relativePath}:symbolic-link-artifact`);
        continue;
      }

      if (artifact.kind !== "file") {
        await rm(artifact.path, { force: true });
        findings.push(`${relativePath}:unsafe-artifact-node`);
        continue;
      }

      if (
        !allowedTextArtifactExtensions.has(
          path.extname(artifact.path).toLowerCase(),
        )
      ) {
        await rm(artifact.path, { force: true });
        findings.push(`${relativePath}:unsafe-binary-artifact`);
        continue;
      }

      if (fileCount > limits.maxFileCount) {
        const action = await quarantineTextArtifact(artifact.path);
        findings.push(`${relativePath}:artifact-file-count-budget:${action}`);
        continue;
      }

      if (artifact.size > limits.maxFileBytes) {
        const action = await quarantineTextArtifact(artifact.path);
        findings.push(`${relativePath}:artifact-file-byte-budget:${action}`);
        continue;
      }

      if (treeBytes > limits.maxTreeBytes) {
        const action = await quarantineTextArtifact(artifact.path);
        findings.push(`${relativePath}:artifact-tree-byte-budget:${action}`);
        continue;
      }

      const text = await readFile(artifact.path, "utf8");
      const actualBytes = Buffer.byteLength(text, "utf8");
      if (actualBytes > limits.maxFileBytes) {
        const action = await quarantineTextArtifact(artifact.path);
        findings.push(`${relativePath}:artifact-file-byte-budget:${action}`);
        continue;
      }

      const sanitized = await sanitizeTextArtifact(
        artifact.path,
        text,
        runtimeSensitiveValues,
      );
      sanitized?.violations.forEach((violation) => {
        findings.push(`${relativePath}:${violation}:${sanitized.action}`);
      });
    }
  }

  if (findings.length > 0) {
    throw new Error(
      `Playwright artifact privacy policy failed:\n${findings.sort().join("\n")}`,
    );
  }
};

export const scanPlaywrightArtifacts = async (config) => {
  const selectedProjectNames = readSelectedProjectNames();
  const configuredRoots = config?.projects
    ?.filter(
      (project) =>
        selectedProjectNames.size === 0 ||
        selectedProjectNames.has(project.name),
    )
    ?.map((project) => project.outputDir)
    .filter(Boolean);
  const directories =
    configuredRoots?.length > 0
      ? [...new Set(configuredRoots)]
      : artifactRoots.map((artifactRoot) =>
          path.join(projectRoot, artifactRoot),
        );

  await scanArtifactDirectories(directories);
};

const runSelfTest = async () => {
  const selectedProjectNames = readSelectedProjectNames([
    "--project=local-core",
    "--project",
    "local-toss-sandbox",
  ]);
  if (
    selectedProjectNames.size !== 2 ||
    !selectedProjectNames.has("local-core") ||
    !selectedProjectNames.has("local-toss-sandbox")
  ) {
    throw new Error("Artifact scanner did not preserve CLI project ownership.");
  }

  COMMITTED_PRIVACY_CANARIES.forEach((canary, index) => {
    const violations = findTextViolations(`fixture ${canary}`);
    if (!violations.includes(`committed-canary-${index + 1}`)) {
      throw new Error(`Artifact scanner missed committed canary ${index + 1}.`);
    }
  });

  const ansiSplitCanary = COMMITTED_PRIVACY_CANARIES[0].replace(
    "private",
    "pri\u001b[7mva\u001b[27mte",
  );
  if (!findTextViolations(ansiSplitCanary).includes("committed-canary-1")) {
    throw new Error("Artifact scanner missed an ANSI-split committed canary.");
  }

  const allowedSyntheticText =
    "person-a@example.invalid synthetic-password [redacted] test_ck_synthetic";
  if (findTextViolations(allowedSyntheticText).length > 0) {
    throw new Error(
      "Artifact scanner rejected the synthetic fixture allowlist.",
    );
  }

  const runtimeEnvironment = {
    AIRBOB_LOCAL_COMPLIMENTARY_COUPON_ID: "73",
    AIRBOB_LOCAL_PAID_FIXTURES: JSON.stringify([
      {
        accommodationId: "201",
        checkIn: "2026-10-10",
        checkOut: "2026-10-12",
      },
    ]),
    AIRBOB_LOCAL_SEARCH_DESTINATION: "제주",
    AIRBOB_LOCAL_TOSS_CARD_CVC: "123",
    AIRBOB_LOCAL_TOSS_CARD_EXPIRY: "12/30",
    AIRBOB_LOCAL_TOSS_CARD_PASSWORD: "00",
    AIRBOB_LOCAL_WISHLIST_ACCOMMODATION_ID: "201",
    AIRBOB_QA_PASSWORD: 'runtime/"private\\value+7429',
  };
  const runtimeSensitiveValues = readRuntimeSensitiveValues(runtimeEnvironment);
  ["00", "73", "123", "201", "제주", "2026-10-10"].forEach((expectedValue) => {
    if (!runtimeSensitiveValues.includes(expectedValue)) {
      throw new Error(
        "Runtime-sensitive environment collection dropped a configured value.",
      );
    }
  });

  const longRuntimeValue = runtimeEnvironment.AIRBOB_QA_PASSWORD;
  if (
    !findTextViolations(`unlabelled ${longRuntimeValue}`, {
      runtimeSensitiveValues,
    }).includes("runtime-sensitive-value")
  ) {
    throw new Error("Artifact scanner missed an exact runtime value.");
  }
  const runtimeRedacted = redactSensitiveText(
    `unlabelled ${longRuntimeValue}`,
    { runtimeSensitiveValues },
  );
  if (
    runtimeRedacted.includes(longRuntimeValue) ||
    findTextViolations(runtimeRedacted, { runtimeSensitiveValues }).length > 0
  ) {
    throw new Error("Artifact redactor exposed an exact runtime value.");
  }

  const transformedRuntimeValues = [
    encodeURIComponent(longRuntimeValue),
    new URLSearchParams({ value: longRuntimeValue })
      .toString()
      .slice("value=".length),
    JSON.stringify(longRuntimeValue).slice(1, -1),
    Buffer.from(longRuntimeValue, "utf8").toString("base64"),
  ];
  transformedRuntimeValues.forEach((transformedValue) => {
    const input = `transformed ${transformedValue}`;
    const redacted = redactSensitiveText(input, { runtimeSensitiveValues });
    if (
      !findTextViolations(input, { runtimeSensitiveValues }).includes(
        "runtime-sensitive-value",
      ) ||
      redacted.includes(transformedValue) ||
      findTextViolations(redacted, { runtimeSensitiveValues }).length > 0
    ) {
      throw new Error("Artifact policy missed a transformed runtime value.");
    }
  });

  const contextualRuntimeCases = [
    ["short CVC", "cardCvc: 123", "structured-sensitive-value"],
    [
      "short card password JSON",
      '{"cardPassword":"00"}',
      "structured-sensitive-value",
    ],
    [
      "short accommodation path",
      "https://example.invalid/api/v1/accommodations/201/availability",
      "sensitive-resource-path",
    ],
    [
      "short nested member path",
      "/api/v1/members/recently-viewed/201",
      "sensitive-resource-path",
    ],
    [
      "short coupon query",
      "https://example.invalid/coupons?couponId=73",
      "sensitive-callback-query",
    ],
    [
      "URL-encoded destination",
      `https://example.invalid/search?destination=${encodeURIComponent("제주")}`,
      "sensitive-callback-query",
    ],
    [
      "short identifier base64",
      `couponIdBase64: ${Buffer.from("73", "utf8").toString("base64")}`,
      "structured-sensitive-value",
    ],
    ["slash-stripped expiry", "provider field 1230", "runtime-sensitive-value"],
  ];
  contextualRuntimeCases.forEach(([, input, expectedViolation]) => {
    const violations = findTextViolations(input, { runtimeSensitiveValues });
    const redacted = redactSensitiveText(input, { runtimeSensitiveValues });
    if (
      !violations.includes(expectedViolation) ||
      redacted === input ||
      findTextViolations(redacted, { runtimeSensitiveValues }).length > 0
    ) {
      throw new Error("Artifact policy missed a contextual runtime value.");
    }
  });

  const harmlessShortText = "progress 00 of 73; counters 123 and 201";
  if (
    findTextViolations(harmlessShortText, { runtimeSensitiveValues }).length >
      0 ||
    redactSensitiveText(harmlessShortText, { runtimeSensitiveValues }) !==
      harmlessShortText
  ) {
    throw new Error("Artifact policy globally redacted common short values.");
  }

  let runtimeReporterOutput = "";
  const runtimeWriter = createRedactedLineWriter({
    stdout: {
      write: (value) => {
        runtimeReporterOutput += String(value);
      },
    },
    stderr: { write: () => {} },
    runtimeSensitiveValues,
  });
  const runtimeSplit = Math.floor(longRuntimeValue.length / 2);
  runtimeWriter.stdout(`split ${longRuntimeValue.slice(0, runtimeSplit)}`);
  runtimeWriter.stdout(
    `${longRuntimeValue.slice(runtimeSplit)} without field name\n`,
  );
  runtimeWriter.flush();
  if (
    runtimeReporterOutput.includes(longRuntimeValue) ||
    !runtimeReporterOutput.includes("[redacted-runtime]")
  ) {
    throw new Error("Streaming reporter exposed an exact runtime value.");
  }

  const detectorCases = [
    ["private.user@real.example", "non-synthetic-email"],
    [
      "https://example.invalid/callback?paymentKey=private-key",
      "sensitive-callback-query",
    ],
    ["test_sk_private_server_key", "server-secret-key"],
    ["Bearer private-access-token", "bearer-credential"],
    ['customerName: "Private Person"', "structured-sensitive-value"],
    ['{"paymentKey":"private-key"}', "structured-sensitive-value"],
    ['{"customer_name":"Private Person"}', "structured-sensitive-value"],
    ['{"order_id":"private-order"}', "structured-sensitive-value"],
    ['{"token":"private-token"}', "structured-sensitive-value"],
    ['{"password":"private-password"}', "structured-sensitive-value"],
    ['{"accessToken":"private-access"}', "structured-sensitive-value"],
    ['{"refresh_token":"private-refresh"}', "structured-sensitive-value"],
    ['{"sessionToken":"private-session"}', "structured-sensitive-value"],
    ['{"authorization":"private-authorization"}', "structured-sensitive-value"],
    ['{"cookie":"private-cookie"}', "structured-sensitive-value"],
    ['{"secret":"private-secret"}', "structured-sensitive-value"],
    ['{"apiKey":"private-api-key"}', "structured-sensitive-value"],
    ['{"client_secret":"private-client-secret"}', "structured-sensitive-value"],
    ["x-api-key: private-header-key", "structured-sensitive-value"],
    ["x-client-secret: private-header-secret", "structured-sensitive-value"],
    [
      'authorization: {\n  credential: "PRIVATE-CREDENTIAL"\n}',
      "structured-sensitive-value",
    ],
    ['cookie: [\n  "PRIVATE-COOKIE"\n]', "structured-sensitive-value"],
    ["password=`PRIVATE-BACKTICK`", "structured-sensitive-value"],
    [
      String.raw`error={\"password\":\"PRIVATE-PASSWORD\"}`,
      "structured-sensitive-value",
    ],
    [
      String.raw`error={\'paymentKey\':\'PRIVATE-PAYMENT-KEY\'}`,
      "structured-sensitive-value",
    ],
  ];
  detectorCases.forEach(([input, expectedViolation]) => {
    if (!findTextViolations(input).includes(expectedViolation)) {
      throw new Error(`Artifact scanner missed ${expectedViolation}.`);
    }

    const redacted = redactSensitiveText(input);
    if (redacted === input || findTextViolations(redacted).length > 0) {
      throw new Error(`Reporter redaction missed ${expectedViolation}.`);
    }
  });

  const escapeAwareRedactionCases = [
    [
      "escaped double quote",
      String.raw`event password: "private-prefix\"private-suffix" next=synthetic`,
      'event password: "[redacted]" next=synthetic',
    ],
    [
      "escaped single quote",
      String.raw`event token='private-prefix\'private-suffix' next=synthetic`,
      "event token='[redacted]' next=synthetic",
    ],
    [
      "escaped backslashes before a quote",
      String.raw`event paymentKey="private-prefix\\\"private-suffix" next=synthetic`,
      'event paymentKey="[redacted]" next=synthetic',
    ],
    [
      "Unicode quote escape",
      String.raw`event customerName="private-prefix\u0022private-suffix" next=synthetic`,
      'event customerName="[redacted]" next=synthetic',
    ],
    [
      "truncated quoted value",
      String.raw`event password="private-prefix\"private-suffix`,
      'event password="[redacted]',
    ],
  ];
  escapeAwareRedactionCases.forEach(([name, input, expected]) => {
    const redacted = redactSensitiveText(input);

    if (redacted !== expected) {
      throw new Error(`Reporter redaction mishandled ${name}.`);
    }
    if (findTextViolations(redacted).length > 0) {
      throw new Error(`Reporter redaction remained detectable for ${name}.`);
    }
    if (
      redacted.includes("private-prefix") ||
      redacted.includes("private-suffix")
    ) {
      throw new Error(`Reporter redaction exposed the suffix for ${name}.`);
    }
  });

  const unquotedRedactionCases = [
    [
      "space-containing password at line end",
      "event password=correct horse battery staple",
      "event password=[redacted]",
    ],
    [
      "space-containing token before a comma",
      "event token=private token suffix, status=failed",
      "event token=[redacted], status=failed",
    ],
    [
      "space-containing password before a closing brace",
      "event {password: private password suffix}",
      "event {password: [redacted]}",
    ],
    [
      "space-containing token before a newline",
      "event token=private token suffix\nstatus=failed",
      "event token=[redacted]\nstatus=failed",
    ],
  ];
  unquotedRedactionCases.forEach(([name, input, expected]) => {
    const redacted = redactSensitiveText(input);

    if (redacted !== expected) {
      throw new Error(`Reporter redaction mishandled ${name}.`);
    }
    if (findTextViolations(redacted).length > 0) {
      throw new Error(`Reporter redaction remained detectable for ${name}.`);
    }
    if (
      redacted.includes("horse battery staple") ||
      redacted.includes("private token suffix") ||
      redacted.includes("private password suffix")
    ) {
      throw new Error(`Reporter redaction exposed the suffix for ${name}.`);
    }
  });

  const streamingRedactionCases = [
    {
      channel: "stdout",
      input: "event password=private secret suffix\n",
      expected: "event password=[redacted]\n",
      name: "newline-terminated password",
      forbiddenFragments: ["private secret"],
    },
    {
      channel: "stderr",
      input: "event token=private token suffix",
      expected: "event token=[redacted]",
      name: "unterminated token tail",
      forbiddenFragments: ["private token"],
    },
    {
      channel: "stdout",
      input: 'event password="private first\nprivate second"\nstatus=ok\n',
      expected: 'event password="[redacted]\n"\nstatus=ok\n',
      name: "multiline quoted password",
      forbiddenFragments: ["private first", "private second"],
    },
    {
      channel: "stderr",
      input:
        [
          String.raw`event token="private-prefix\"still-private\\`,
          "private-middle",
          String.raw`private-suffix" next=synthetic`,
        ].join("\n") + "\n",
      expected: 'event token="[redacted]\n\n" next=synthetic\n',
      name: "multiline escaped quotes and backslashes",
      forbiddenFragments: [
        "private-prefix",
        "still-private",
        "private-middle",
        "private-suffix",
      ],
    },
    {
      channel: "stdout",
      input:
        'event accessToken=\n  "private access\ncontinued access" status=failed\n',
      expected: "event accessToken=[redacted]\n\n status=failed\n",
      name: "quoted assignment value beginning on the next line",
      forbiddenFragments: ["private access", "continued access"],
    },
    {
      channel: "stderr",
      input: "event cookie:\nprivate session value; status=failed\n",
      expected: "event cookie:[redacted]\n; status=failed\n",
      name: "unquoted assignment value beginning on the next line",
      forbiddenFragments: ["private session value"],
    },
    {
      channel: "stdout",
      input:
        'authorization: {\n  credential: "PRIVATE-CREDENTIAL",\n  nested: [{value: "PRIVATE-NESTED"}]\n}\nstatus=ok\n',
      expected: "authorization: [redacted]\n\n\n\nstatus=ok\n",
      name: "nested multiline authorization object",
      forbiddenFragments: ["PRIVATE-CREDENTIAL", "PRIVATE-NESTED"],
    },
    {
      channel: "stderr",
      input:
        'cookie: [\n  "PRIVATE-COOKIE",\n  {nested: ["PRIVATE-ARRAY"]}\n]\nstatus=ok\n',
      expected: "cookie: [redacted]\n\n\n\nstatus=ok\n",
      name: "nested multiline cookie array",
      forbiddenFragments: ["PRIVATE-COOKIE", "PRIVATE-ARRAY"],
    },
    {
      channel: "stdout",
      input:
        "password=`PRIVATE-BACKTICK-FIRST\\`STILL-PRIVATE\nPRIVATE-BACKTICK-SECOND` status=ok\n",
      expected: "password=`[redacted]\n` status=ok\n",
      name: "multiline backtick password",
      forbiddenFragments: [
        "PRIVATE-BACKTICK-FIRST",
        "STILL-PRIVATE",
        "PRIVATE-BACKTICK-SECOND",
      ],
    },
    {
      channel: "stderr",
      input: `\u001b[31m${String.raw`error={\"password\":\"PRIVATE-PASSWORD\",\"paymentKey\":\"PRIVATE-PAYMENT-KEY\"}`}\u001b[39m\n`,
      expected:
        String.raw`error={\"password\":\"[redacted]\",\"paymentKey\":\"[redacted]\"}` +
        "\n",
      name: "ANSI wrapped escaped serialized JSON",
      forbiddenFragments: ["PRIVATE-PASSWORD", "PRIVATE-PAYMENT-KEY"],
    },
    {
      channel: "stdout",
      input:
        'auth\u001b[7mo\u001b[27mrization: \u001b[31m{\u001b[39m\n  credential: "PRIVATE-ANSI-CREDENTIAL"\n}\nstatus=ok\n',
      expected: "authorization: [redacted]\n\n\nstatus=ok\n",
      name: "ANSI transparent sensitive key and structured opener",
      forbiddenFragments: ["PRIVATE-ANSI-CREDENTIAL"],
    },
    {
      channel: "stdout",
      input:
        String.raw`error={\'customerEmail\':\'PRIVATE-CUSTOMER\',\'password\':\'PRIVATE-PASSWORD\'}` +
        "\n",
      expected:
        String.raw`error={\'customerEmail\':\'[redacted]\',\'password\':\'[redacted]\'}` +
        "\n",
      name: "single-quote escaped serialized JSON",
      forbiddenFragments: ["PRIVATE-CUSTOMER", "PRIVATE-PASSWORD"],
    },
    {
      channel: "stderr",
      input:
        String.raw`error={\"password\":\"PRIVATE-PREFIX\\\"STILL-PRIVATE` +
        "\nPRIVATE-SUFFIX" +
        String.raw`\"}` +
        "\n",
      expected:
        String.raw`error={\"password\":\"[redacted]` +
        "\n" +
        String.raw`\"}` +
        "\n",
      name: "multiline escaped serialized JSON value",
      forbiddenFragments: ["PRIVATE-PREFIX", "STILL-PRIVATE", "PRIVATE-SUFFIX"],
    },
    {
      channel: "stdout",
      input: 'configuration: {\n  credential: "VISIBLE-CONFIGURATION"\n}\n',
      expected: 'configuration: {\n  credential: "VISIBLE-CONFIGURATION"\n}\n',
      name: "non-sensitive multiline configuration",
      forbiddenFragments: [],
    },
  ];
  streamingRedactionCases.forEach(
    ({ channel, input, expected, name, forbiddenFragments }) => {
      for (let offset = 0; offset <= input.length; offset += 1) {
        let stdout = "";
        let stderr = "";
        const writer = createRedactedLineWriter({
          stdout: {
            write: (value) => {
              stdout += String(value);
            },
          },
          stderr: {
            write: (value) => {
              stderr += String(value);
            },
          },
        });

        writer[channel](input.slice(0, offset));
        writer[channel](input.slice(offset));

        if (!input.endsWith("\n") && (stdout || stderr)) {
          throw new Error(`Streaming reporter emitted an incomplete ${name}.`);
        }

        writer.flush();
        const output = channel === "stdout" ? stdout : stderr;

        if (output !== expected) {
          throw new Error(
            `Streaming reporter mishandled ${name} split offset ${offset}.`,
          );
        }
        if (
          forbiddenFragments.some((fragment) => output.includes(fragment)) ||
          findTextViolations(output).length > 0
        ) {
          throw new Error(
            `Streaming reporter exposed ${name} split offset ${offset}.`,
          );
        }
      }
    },
  );

  const previousForceColor = process.env.FORCE_COLOR;
  const previousNoColor = process.env.NO_COLOR;
  let coloredPlaywrightStack = "";
  const nestedPlaywrightStacks = [];

  try {
    process.env.FORCE_COLOR = "1";
    delete process.env.NO_COLOR;
    const { expect: playwrightExpect } = await import("@playwright/test");
    const captureFailure = (received, expected) => {
      try {
        playwrightExpect(received).toBe(expected);
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
      throw new Error("Playwright redaction fixture unexpectedly passed.");
    };

    coloredPlaywrightStack = captureFailure(
      JSON.stringify({
        password: "PRIVATE-COLORED-PASSWORD",
        paymentKey: "PRIVATE-COLORED-PAYMENT",
      }),
      JSON.stringify({ passw0rd: "other", payment_key: "other" }),
    );

    let nestedSerializedValue = {
      password:
        'PRIVATE-NESTED-PREFIX"PRIVATE-NESTED-SUFFIX\\PRIVATE-NESTED-TAIL',
    };
    for (let depth = 1; depth <= 6; depth += 1) {
      nestedSerializedValue = JSON.stringify(nestedSerializedValue);
      nestedPlaywrightStacks.push({
        depth,
        stack: captureFailure(nestedSerializedValue, "other"),
      });
    }
  } finally {
    if (previousForceColor === undefined) {
      delete process.env.FORCE_COLOR;
    } else {
      process.env.FORCE_COLOR = previousForceColor;
    }
    if (previousNoColor === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = previousNoColor;
    }
  }

  const assertPlaywrightStackRedaction = ({
    input,
    name,
    forbiddenFragments,
  }) => {
    for (let offset = 0; offset <= input.length; offset += 1) {
      let output = "";
      const writer = createRedactedLineWriter({
        stdout: {
          write: (value) => {
            output += String(value);
          },
        },
        stderr: { write: () => {} },
      });
      writer.stdout(input.slice(0, offset));
      writer.stdout(input.slice(offset));
      writer.flush();

      if (
        forbiddenFragments.some((fragment) => output.includes(fragment)) ||
        output.includes("\u001b") ||
        !output.includes("[redacted]") ||
        findTextViolations(output).length > 0
      ) {
        throw new Error(
          `Streaming reporter exposed ${name} split offset ${offset}.`,
        );
      }
    }
  };

  if (!coloredPlaywrightStack.includes("\u001b")) {
    throw new Error("Playwright FORCE_COLOR fixture did not contain VT codes.");
  }
  if (
    !findTextViolations(coloredPlaywrightStack).includes(
      "structured-sensitive-value",
    )
  ) {
    throw new Error("Artifact detector missed a FORCE_COLOR Playwright stack.");
  }
  assertPlaywrightStackRedaction({
    input: `${coloredPlaywrightStack}\n`,
    name: "actual FORCE_COLOR Playwright diff",
    forbiddenFragments: ["PRIVATE-COLORED-PASSWORD", "PRIVATE-COLORED-PAYMENT"],
  });

  nestedPlaywrightStacks.forEach(({ depth, stack }) => {
    if (!findTextViolations(stack).includes("structured-sensitive-value")) {
      throw new Error(
        `Artifact detector missed nested JSON serialization depth ${depth}.`,
      );
    }
    assertPlaywrightStackRedaction({
      input: `${stack}\n`,
      name: `nested JSON serialization depth ${depth}`,
      forbiddenFragments: [
        "PRIVATE-NESTED-PREFIX",
        "PRIVATE-NESTED-SUFFIX",
        "PRIVATE-NESTED-TAIL",
      ],
    });
  });

  let interleavedStdout = "";
  let interleavedStderr = "";
  const interleavedWriter = createRedactedLineWriter({
    stdout: {
      write: (value) => {
        interleavedStdout += String(value);
      },
    },
    stderr: {
      write: (value) => {
        interleavedStderr += String(value);
      },
    },
  });
  interleavedWriter.stdout("pass");
  interleavedWriter.stderr("to");
  interleavedWriter.stdout("word=private secret\n");
  interleavedWriter.stderr("ken=private token suffix\n");
  interleavedWriter.flush();

  if (
    interleavedStdout !== "password=[redacted]\n" ||
    interleavedStderr !== "token=[redacted]\n"
  ) {
    throw new Error("Streaming reporter mixed stdout and stderr tails.");
  }

  let multilineStdout = "";
  let multilineStderr = "";
  const multilineInterleavedWriter = createRedactedLineWriter({
    stdout: {
      write: (value) => {
        multilineStdout += String(value);
      },
    },
    stderr: {
      write: (value) => {
        multilineStderr += String(value);
      },
    },
  });
  multilineInterleavedWriter.stdout("pass");
  multilineInterleavedWriter.stderr("to");
  multilineInterleavedWriter.stdout('word="stdout-private\n');
  multilineInterleavedWriter.stderr("ken='stderr-private\n");
  multilineInterleavedWriter.stderr("stderr-continuation' stderr=safe\n");
  multilineInterleavedWriter.stdout('stdout-continuation" stdout=safe\n');
  multilineInterleavedWriter.flush();

  if (
    multilineStdout !== 'password="[redacted]\n" stdout=safe\n' ||
    multilineStderr !== "token='[redacted]\n' stderr=safe\n" ||
    multilineStdout.includes("stdout-private") ||
    multilineStdout.includes("stdout-continuation") ||
    multilineStderr.includes("stderr-private") ||
    multilineStderr.includes("stderr-continuation")
  ) {
    throw new Error(
      "Streaming reporter mixed multiline stdout and stderr state.",
    );
  }

  let oversizedOutput = "";
  const oversizedWriter = createRedactedLineWriter({
    stdout: {
      write: (value) => {
        oversizedOutput += String(value);
      },
    },
    stderr: { write: () => {} },
  });
  oversizedWriter.stdout(`message=${"x".repeat(70 * 1024)}`);
  oversizedWriter.stdout(" password=oversized-private\n");
  oversizedWriter.flush();
  oversizedWriter.stdout("status=available-after-reset\n");
  oversizedWriter.flush();

  if (
    oversizedOutput !==
      "[redacted oversized log record]\nstatus=available-after-reset\n" ||
    oversizedOutput.includes("oversized-private") ||
    oversizedOutput.includes("message=")
  ) {
    throw new Error("Streaming reporter did not bound an oversized record.");
  }

  let reporterStdout = "";
  let reporterStderr = "";
  const reporter = new RedactedLineReporter({
    stdout: {
      write: (value) => {
        reporterStdout += String(value);
      },
    },
    stderr: {
      write: (value) => {
        reporterStderr += String(value);
      },
    },
  });
  reporter.onStdOut("password=`PRIVATE-BACKTICK-FIRST\n");
  reporter.onStdOut("PRIVATE-BACKTICK-UNTERMINATED");
  reporter.onStdErr("cookie: [\n");
  reporter.onStdErr('  "PRIVATE-COOKIE-UNTERMINATED"\n');
  await reporter.onEnd({ status: "passed" });

  if (
    reporterStdout.includes("PRIVATE-BACKTICK-FIRST") ||
    reporterStdout.includes("PRIVATE-BACKTICK-UNTERMINATED") ||
    reporterStderr.includes("PRIVATE-COOKIE-UNTERMINATED") ||
    !reporterStdout.includes("password=`[redacted]") ||
    !reporterStderr.includes("cookie: [redacted]") ||
    findTextViolations(reporterStdout).length > 0 ||
    findTextViolations(reporterStderr).length > 0
  ) {
    throw new Error("Reporter onEnd did not fail-closed flush channel tails.");
  }

  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "airbob-artifact-scan-"),
  );
  try {
    const unsafeReportPath = path.join(temporaryRoot, "unsafe-report.txt");
    const errorContextPath = path.join(temporaryRoot, "error-context.md");
    const unsafeScreenshotPath = path.join(
      temporaryRoot,
      "unsafe-screenshot.png",
    );
    const unsafeLinkPath = path.join(temporaryRoot, "unsafe-link.log");
    await writeFile(
      unsafeReportPath,
      COMMITTED_PRIVACY_CANARIES.join("\n"),
      "utf8",
    );
    await writeFile(
      errorContextPath,
      [
        "# Error context",
        '{"customerName":"Private Person","cvc":"123","cardPassword":"00"}',
        `page: https://example.invalid/api/v1/accommodations/201?couponId=73&destination=${encodeURIComponent("제주")}`,
      ].join("\n"),
      "utf8",
    );
    await writeFile(unsafeScreenshotPath, "binary");
    await symlink("unsafe-report.txt", unsafeLinkPath);

    let rejectedUnsafeTree = false;
    try {
      await scanArtifactDirectories([temporaryRoot], {
        runtimeSensitiveValues,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      rejectedUnsafeTree =
        message.includes("committed-canary-1") &&
        message.includes("structured-sensitive-value") &&
        message.includes("sensitive-resource-path") &&
        message.includes("sensitive-callback-query") &&
        message.includes("unsafe-binary-artifact") &&
        message.includes("symbolic-link-artifact");
    }

    if (!rejectedUnsafeTree) {
      throw new Error("Artifact scanner accepted an unsafe artifact tree.");
    }

    for (const sanitizedPath of [unsafeReportPath, errorContextPath]) {
      const sanitizedText = await readFile(sanitizedPath, "utf8");
      if (
        findTextViolations(sanitizedText, { runtimeSensitiveValues }).length > 0
      ) {
        throw new Error("Artifact scanner retained unsafe text after failure.");
      }
    }

    for (const removedPath of [unsafeScreenshotPath, unsafeLinkPath]) {
      try {
        await lstat(removedPath);
        throw new Error(
          "Artifact scanner retained a removable unsafe artifact.",
        );
      } catch (error) {
        if (!(error && typeof error === "object" && error.code === "ENOENT")) {
          throw error;
        }
      }
    }

    const fileBudgetRoot = path.join(temporaryRoot, "file-budget");
    await mkdir(fileBudgetRoot);
    const oversizedTextPath = path.join(fileBudgetRoot, "oversized.log");
    await writeFile(oversizedTextPath, "x".repeat(65), "utf8");
    let rejectedFileBudget = false;
    try {
      await scanArtifactDirectories([fileBudgetRoot], {
        limits: { maxFileBytes: 64, maxFileCount: 10, maxTreeBytes: 1_024 },
        runtimeSensitiveValues,
      });
    } catch (error) {
      rejectedFileBudget = String(error).includes("artifact-file-byte-budget");
    }
    if (
      !rejectedFileBudget ||
      (await readFile(oversizedTextPath, "utf8")) !== ARTIFACT_QUARANTINE_MARKER
    ) {
      throw new Error("Artifact scanner did not enforce the file byte budget.");
    }

    const countBudgetRoot = path.join(temporaryRoot, "count-budget");
    await mkdir(countBudgetRoot);
    const countBudgetPaths = ["one.log", "two.log"].map((name) =>
      path.join(countBudgetRoot, name),
    );
    await Promise.all(
      countBudgetPaths.map((artifactPath) =>
        writeFile(artifactPath, "safe", "utf8"),
      ),
    );
    let rejectedCountBudget = false;
    try {
      await scanArtifactDirectories([countBudgetRoot], {
        limits: {
          maxFileBytes: 64,
          maxFileCount: 1,
          maxTreeBytes: 1_024,
        },
        runtimeSensitiveValues,
      });
    } catch (error) {
      rejectedCountBudget = String(error).includes(
        "artifact-file-count-budget",
      );
    }
    const countBudgetContents = await Promise.all(
      countBudgetPaths.map((artifactPath) => readFile(artifactPath, "utf8")),
    );
    if (
      !rejectedCountBudget ||
      !countBudgetContents.includes(ARTIFACT_QUARANTINE_MARKER)
    ) {
      throw new Error(
        "Artifact scanner did not enforce the file count budget.",
      );
    }

    const treeBudgetRoot = path.join(temporaryRoot, "tree-budget");
    await mkdir(treeBudgetRoot);
    const treeBudgetPaths = ["one.log", "two.log"].map((name) =>
      path.join(treeBudgetRoot, name),
    );
    await Promise.all(
      treeBudgetPaths.map((artifactPath) =>
        writeFile(artifactPath, "x".repeat(40), "utf8"),
      ),
    );
    let rejectedTreeBudget = false;
    try {
      await scanArtifactDirectories([treeBudgetRoot], {
        limits: { maxFileBytes: 64, maxFileCount: 10, maxTreeBytes: 60 },
        runtimeSensitiveValues,
      });
    } catch (error) {
      rejectedTreeBudget = String(error).includes("artifact-tree-byte-budget");
    }
    const treeBudgetContents = await Promise.all(
      treeBudgetPaths.map((artifactPath) => readFile(artifactPath, "utf8")),
    );
    if (
      !rejectedTreeBudget ||
      !treeBudgetContents.includes(ARTIFACT_QUARANTINE_MARKER)
    ) {
      throw new Error("Artifact scanner did not enforce the tree byte budget.");
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
};

export default scanPlaywrightArtifacts;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes("--self-test")) {
      await runSelfTest();
      process.stdout.write(
        "Playwright artifact privacy scanner self-test passed.\n",
      );
    } else {
      await scanPlaywrightArtifacts();
      process.stdout.write("Playwright artifacts passed the privacy scan.\n");
    }
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Artifact scan failed."}\n`,
    );
    process.exitCode = 1;
  }
}
