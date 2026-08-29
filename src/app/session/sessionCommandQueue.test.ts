import { createSessionCommandQueue } from "./sessionCommandQueue";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
};

describe("sessionCommandQueue", () => {
  it("starts cookie-mutating commands in invocation order", async () => {
    const queue = createSessionCommandQueue();
    const first = deferred<void>();
    const calls: string[] = [];
    const firstController = new AbortController();
    const secondController = new AbortController();
    const firstRun = queue.run(firstController.signal, async () => {
      calls.push("first:start");
      await first.promise;
      calls.push("first:end");
    });
    const secondRun = queue.run(secondController.signal, async () => {
      calls.push("second:start");
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toEqual(["first:start"]);

    first.resolve();
    await Promise.all([firstRun, secondRun]);
    expect(calls).toEqual(["first:start", "first:end", "second:start"]);
  });

  it("does not let a later command overtake an aborted transport that has not settled", async () => {
    const queue = createSessionCommandQueue();
    const hung = deferred<void>();
    const firstController = new AbortController();
    const secondController = new AbortController();
    const firstRun = queue.run(firstController.signal, () => hung.promise);
    const secondCommand = jest.fn().mockResolvedValue(undefined);
    const secondRun = queue.run(secondController.signal, secondCommand);

    firstController.abort();

    await expect(firstRun).rejects.toMatchObject({ name: "AbortError" });
    expect(secondCommand).not.toHaveBeenCalled();

    hung.resolve();
    await hung.promise;
    await secondRun;
    expect(secondCommand).toHaveBeenCalledTimes(1);
  });

  it("does not start a command aborted before its physical slot begins", async () => {
    const queue = createSessionCommandQueue();
    const controller = new AbortController();
    const command = jest.fn().mockResolvedValue(undefined);
    const run = queue.run(controller.signal, command);

    controller.abort();

    await expect(run).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve();
    expect(command).not.toHaveBeenCalled();
  });

  it("does not let a rejected command poison the queue", async () => {
    const queue = createSessionCommandQueue();
    const failure = new Error("failed");
    const first = queue.run(new AbortController().signal, () =>
      Promise.reject(failure),
    );
    const second = queue.run(
      new AbortController().signal,
      async () => "recovered",
    );

    await expect(first).rejects.toBe(failure);
    await expect(second).resolves.toBe("recovered");
  });

  it("does not invoke a command whose signal was aborted while queued", async () => {
    const queue = createSessionCommandQueue();
    const first = deferred<void>();
    const firstRun = queue.run(new AbortController().signal, () => first.promise);
    const queuedController = new AbortController();
    const queuedCommand = jest.fn().mockResolvedValue(undefined);
    const queuedRun = queue.run(queuedController.signal, queuedCommand);
    queuedController.abort();
    first.resolve();

    await firstRun;
    await expect(queuedRun).rejects.toMatchObject({ name: "AbortError" });
    expect(queuedCommand).not.toHaveBeenCalled();
  });

  it("keeps physical ordering local to each provider queue", async () => {
    const firstProviderQueue = createSessionCommandQueue();
    const secondProviderQueue = createSessionCommandQueue();
    const firstProviderTransport = deferred<void>();
    const firstRun = firstProviderQueue.run(
      new AbortController().signal,
      () => firstProviderTransport.promise,
    );
    const secondProviderCommand = jest.fn().mockResolvedValue(undefined);

    await secondProviderQueue.run(
      new AbortController().signal,
      secondProviderCommand,
    );

    expect(secondProviderCommand).toHaveBeenCalledTimes(1);
    firstProviderTransport.resolve();
    await firstRun;
  });
});
