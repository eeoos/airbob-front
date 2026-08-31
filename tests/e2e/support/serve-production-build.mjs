import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const rawPort = process.env.AIRBOB_E2E_PORT;
if (!rawPort || !/^\d+$/.test(rawPort)) {
  throw new Error("AIRBOB_E2E_PORT must be an explicit numeric loopback port.");
}
const PORT = Number(rawPort);
if (!Number.isSafeInteger(PORT) || PORT < 1024 || PORT > 65_535) {
  throw new Error("AIRBOB_E2E_PORT is outside the allowed unprivileged range.");
}
const EXPECTED_HOST = `${HOST}:${PORT}`;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../../..");
const buildRoot = path.join(projectRoot, "build");
const buildRootPrefix = `${buildRoot}${path.sep}`;

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webmanifest", "application/manifest+json"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const runBuild = () =>
  new Promise((resolve, reject) => {
    const build = spawn(npmCommand, ["run", "build"], {
      cwd: projectRoot,
      env: process.env,
      stdio: "inherit",
    });

    build.once("error", reject);
    build.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Production build failed before E2E server start (${signal ?? code}).`,
        ),
      );
    });
  });

const isFile = async (filePath) => {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
};

const sendText = (response, statusCode, message) => {
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type": "text/plain; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  response.end(message);
};

await runBuild();

const server = createServer(async (request, response) => {
  if (request.headers.host !== EXPECTED_HOST) {
    sendText(response, 421, "Unexpected host");
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("allow", "GET, HEAD");
    sendText(response, 405, "Method not allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(request.url ?? "/", `http://${EXPECTED_HOST}`).pathname,
    );
  } catch {
    sendText(response, 400, "Invalid request path");
    return;
  }

  const requestedPath = path.resolve(buildRoot, `.${pathname}`);
  if (
    requestedPath !== buildRoot &&
    !requestedPath.startsWith(buildRootPrefix)
  ) {
    sendText(response, 403, "Request path is outside the build root");
    return;
  }

  let filePath = requestedPath;
  if (!(await isFile(filePath))) {
    if (path.extname(pathname)) {
      sendText(response, 404, "Asset not found");
      return;
    }

    filePath = path.join(buildRoot, "index.html");
  }

  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type":
      contentTypes.get(path.extname(filePath).toLowerCase()) ??
      "application/octet-stream",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.once("error", () => {
    if (!response.headersSent) {
      sendText(response, 500, "Unable to read build asset");
      return;
    }

    response.destroy();
  });
  stream.pipe(response);
});

server.listen(PORT, HOST, () => {
  process.stdout.write(
    `Deterministic E2E server listening on http://${EXPECTED_HOST}\n`,
  );
});

const closeServer = () => {
  server.close(() => process.exit(0));
};

process.once("SIGINT", closeServer);
process.once("SIGTERM", closeServer);
