import { redactSensitiveText } from "./sensitive-text.mjs";

const write = (stream, value) => {
  const text = Buffer.isBuffer(value) ? value.toString() : value;
  stream.write(redactSensitiveText(text));
};

const formatError = (error) =>
  error?.stack ?? error?.message ?? error?.value ?? String(error);

export default class RedactedLineReporter {
  constructor() {
    this.total = 0;
    this.completed = 0;
    this.counts = new Map();
  }

  printsToStdio() {
    return true;
  }

  onBegin(_config, suite) {
    this.total = suite.allTests().length;
    write(process.stdout, `Running ${this.total} deterministic browser tests\n`);
  }

  onTestEnd(test, result) {
    this.completed += 1;
    this.counts.set(result.status, (this.counts.get(result.status) ?? 0) + 1);
    const title = test.titlePath().slice(1).join(" › ");
    write(
      process.stdout,
      `[${this.completed}/${this.total}] ${result.status}: ${title}\n`,
    );

    if (result.status !== "passed" && result.status !== "skipped") {
      result.errors.forEach((error) => {
        write(process.stderr, `${formatError(error)}\n`);
      });
    }
  }

  onError(error) {
    write(process.stderr, `${formatError(error)}\n`);
  }

  onStdOut(chunk) {
    write(process.stdout, chunk);
  }

  onStdErr(chunk) {
    write(process.stderr, chunk);
  }

  async onEnd(result) {
    const summary = [...this.counts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([status, count]) => `${status}=${count}`)
      .join(", ");
    write(process.stdout, `Browser suite ${result.status}: ${summary}\n`);
  }
}
