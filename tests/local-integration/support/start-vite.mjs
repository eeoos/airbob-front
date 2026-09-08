import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createLocalViteEnvironment,
  LOCAL_INTEGRATION_VITE_PORT,
} from "./environment.mjs";

const supportDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(supportDirectory, "../../..");
const viteEntry = path.join(projectRoot, "node_modules/vite/bin/vite.js");

const safeProcessEnvironment = (environment) => ({
  ...createLocalViteEnvironment(environment),
  FORCE_COLOR: "0",
  LANG: environment.LANG ?? "C.UTF-8",
  NODE_ENV: "development",
  NO_COLOR: "1",
  PATH: environment.PATH ?? "",
  TMPDIR: environment.TMPDIR ?? "/tmp",
});

export const startLocalIntegrationVite = ({
  environment = process.env,
  stdio = "inherit",
} = {}) =>
  spawn(
    process.execPath,
    [
      viteEntry,
      "--host",
      "127.0.0.1",
      "--port",
      String(LOCAL_INTEGRATION_VITE_PORT),
      "--strictPort",
      "--mode",
      "development",
    ],
    {
      cwd: projectRoot,
      env: safeProcessEnvironment(environment),
      stdio,
    },
  );

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const child = startLocalIntegrationVite();
  let terminating = false;

  const forwardSignal = (signal) => {
    if (terminating) return;
    terminating = true;
    child.kill(signal);
  };

  process.once("SIGINT", () => forwardSignal("SIGINT"));
  process.once("SIGTERM", () => forwardSignal("SIGTERM"));
  child.once("error", () => {
    process.stderr.write("Local integration frontend failed to start.\n");
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    if (signal) {
      process.exitCode = terminating ? 0 : 1;
      return;
    }
    process.exitCode = code ?? 1;
  });
}
