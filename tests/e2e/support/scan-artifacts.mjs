import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMMITTED_PRIVACY_CANARIES,
  findSensitiveTextViolations,
  normalizeSensitiveText,
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

export const findTextViolations = (text) => {
  const normalizedText = normalizeSensitiveText(text);
  const violations = new Set(findSensitiveTextViolations(normalizedText));

  COMMITTED_PRIVACY_CANARIES.forEach((canary, index) => {
    if (normalizedText.includes(canary)) {
      violations.add(`committed-canary-${index + 1}`);
    }
  });

  return [...violations].sort();
};

const collectArtifactFiles = async (directory) => {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isSymbolicLink()) {
      files.push({ path: entryPath, kind: "symbolic-link" });
    } else if (entry.isDirectory()) {
      files.push(...(await collectArtifactFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push({ path: entryPath, kind: "file" });
    }
  }

  return files;
};

const scanArtifactDirectories = async (directories) => {
  const findings = [];

  for (const absoluteRoot of directories) {
    const files = await collectArtifactFiles(absoluteRoot);

    for (const artifact of files) {
      const relativePath = path.relative(projectRoot, artifact.path);

      if (artifact.kind === "symbolic-link") {
        findings.push(`${relativePath}:symbolic-link-artifact`);
        continue;
      }

      if (
        !allowedTextArtifactExtensions.has(
          path.extname(artifact.path).toLowerCase(),
        )
      ) {
        findings.push(`${relativePath}:unsafe-binary-artifact`);
        continue;
      }

      const text = await readFile(artifact.path, "utf8");
      findTextViolations(text).forEach((violation) => {
        findings.push(`${relativePath}:${violation}`);
      });
    }
  }

  if (findings.length > 0) {
    throw new Error(
      `Playwright artifact privacy policy failed:\n${findings.sort().join("\n")}`,
    );
  }
};

export const scanPlaywrightArtifacts = async () =>
  scanArtifactDirectories(
    artifactRoots.map((artifactRoot) => path.join(projectRoot, artifactRoot)),
  );

const runSelfTest = async () => {
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
    await writeFile(
      path.join(temporaryRoot, "unsafe-report.txt"),
      COMMITTED_PRIVACY_CANARIES.join("\n"),
      "utf8",
    );
    await writeFile(
      path.join(temporaryRoot, "unsafe-screenshot.png"),
      "binary",
    );

    let rejectedUnsafeTree = false;
    try {
      await scanArtifactDirectories([temporaryRoot]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      rejectedUnsafeTree =
        message.includes("committed-canary-1") &&
        message.includes("unsafe-binary-artifact");
    }

    if (!rejectedUnsafeTree) {
      throw new Error("Artifact scanner accepted an unsafe artifact tree.");
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
