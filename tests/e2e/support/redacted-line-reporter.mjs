import { createStreamingSensitiveTextRedactor } from "./sensitive-text.mjs";

const toText = (value) =>
  Buffer.isBuffer(value) ? value.toString() : String(value);

const MAX_BUFFERED_RECORD_LENGTH = 64 * 1024;
const OVERSIZED_RECORD_MARKER = "[redacted oversized log record]";

const createBufferedChannel = (stream) => {
  let tail = "";
  let quarantined = false;
  const redactor = createStreamingSensitiveTextRedactor();

  const emitRecord = (record) => {
    stream.write(redactor.redact(record));
  };

  const enterQuarantine = () => {
    tail = "";
    quarantined = true;
    stream.write(OVERSIZED_RECORD_MARKER);
  };

  const append = (text) => {
    let cursor = 0;

    while (cursor < text.length && !quarantined) {
      const newlineIndex = text.indexOf("\n", cursor);
      const fragmentEnd = newlineIndex < 0 ? text.length : newlineIndex + 1;
      const fragment = text.slice(cursor, fragmentEnd);

      if (tail.length + fragment.length > MAX_BUFFERED_RECORD_LENGTH) {
        enterQuarantine();
        return;
      }

      tail += fragment;
      cursor = fragmentEnd;

      if (newlineIndex >= 0) {
        emitRecord(tail);
        tail = "";
      }
    }
  };

  return {
    write(value) {
      if (quarantined) return;

      append(toText(value));
    },
    flush() {
      if (quarantined) {
        stream.write("\n");
      } else if (tail) {
        emitRecord(tail);
      }

      tail = "";
      quarantined = false;
      redactor.reset();
    },
  };
};

export const createRedactedLineWriter = ({ stdout, stderr }) => {
  const stdoutChannel = createBufferedChannel(stdout);
  const stderrChannel = createBufferedChannel(stderr);

  return {
    stdout: (value) => stdoutChannel.write(value),
    stderr: (value) => stderrChannel.write(value),
    flush: () => {
      stdoutChannel.flush();
      stderrChannel.flush();
    },
  };
};

const formatError = (error) =>
  error?.stack ?? error?.message ?? error?.value ?? String(error);

export class RedactedLineReporter {
  constructor({ stdout = process.stdout, stderr = process.stderr } = {}) {
    this.total = 0;
    this.completed = 0;
    this.counts = new Map();
    this.output = createRedactedLineWriter({ stdout, stderr });
  }

  printsToStdio() {
    return true;
  }

  onBegin(_config, suite) {
    this.total = suite.allTests().length;
    this.output.stdout(`Running ${this.total} deterministic browser tests\n`);
  }

  onTestEnd(test, result) {
    this.completed += 1;
    this.counts.set(result.status, (this.counts.get(result.status) ?? 0) + 1);
    const title = test.titlePath().slice(1).join(" › ");
    this.output.stdout(
      `[${this.completed}/${this.total}] ${result.status}: ${title}\n`,
    );

    if (result.status !== "passed" && result.status !== "skipped") {
      result.errors.forEach((error) => {
        this.output.stderr(`${formatError(error)}\n`);
      });
    }
  }

  onError(error) {
    this.output.stderr(`${formatError(error)}\n`);
  }

  onStdOut(chunk) {
    this.output.stdout(chunk);
  }

  onStdErr(chunk) {
    this.output.stderr(chunk);
  }

  async onEnd(result) {
    // A test may finish without a trailing newline. Redact and flush those
    // channel-specific tails before writing the reporter's final record.
    this.output.flush();

    const summary = [...this.counts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([status, count]) => `${status}=${count}`)
      .join(", ");
    this.output.stdout(`Browser suite ${result.status}: ${summary}\n`);
    this.output.flush();
  }
}

export default RedactedLineReporter;
