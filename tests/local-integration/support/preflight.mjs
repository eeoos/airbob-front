import net from "node:net";
import {
  loadLocalIntegrationEnvironment,
  LocalIntegrationBlockedError,
} from "./environment.mjs";

const REQUEST_TIMEOUT_MS = 4_000;

const formatBlockedReason = (name, category) => `${name} ${category}`;

const fetchWithTimeout = async (fetchImpl, url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetchImpl(url, {
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const checkHttpReachability = async ({ fetchImpl, name, url }) => {
  let response;
  try {
    response = await fetchWithTimeout(fetchImpl, url);
  } catch {
    throw new LocalIntegrationBlockedError(
      formatBlockedReason(name, "is unreachable"),
    );
  }

  if (!response.ok) {
    throw new LocalIntegrationBlockedError(
      formatBlockedReason(name, "is not ready"),
    );
  }

  return response;
};

const readJsonPayload = async (response) => {
  try {
    const payload = await response.json();
    return payload !== null && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
};

const componentIsUp = (payload, componentName) => {
  const component = payload?.components?.[componentName];
  return component?.status === "UP";
};

const checkBackendReadiness = async ({ fetchImpl, backend }) => {
  const response = await checkHttpReachability({
    fetchImpl,
    name: "backend readiness",
    url: backend.readinessUrl,
  });
  const payload = await readJsonPayload(response);

  if (payload?.status !== "UP") {
    throw new LocalIntegrationBlockedError("backend health is not ready");
  }

  const componentsAreVisible =
    payload.components !== undefined && payload.components !== null;
  if (!componentsAreVisible && !backend.allowAggregateOnlyReadiness) {
    throw new LocalIntegrationBlockedError(
      "custom backend readiness components are not visible",
    );
  }
  const missingComponents = componentsAreVisible
    ? backend.requiredHealthComponents.filter(
        (component) => !componentIsUp(payload, component),
      )
    : [];
  if (missingComponents.length > 0) {
    throw new LocalIntegrationBlockedError(
      "required backend health component is not ready",
    );
  }
};

const checkElasticsearchAlias = async ({ fetchImpl, port }) => {
  await checkHttpReachability({
    fetchImpl,
    name: "elasticsearch accommodation alias",
    url: `http://127.0.0.1:${port}/_alias/accommodations`,
  });
};

const checkDebeziumConnector = async ({ fetchImpl, port }) => {
  const response = await checkHttpReachability({
    fetchImpl,
    name: "debezium connector",
    url: `http://127.0.0.1:${port}/connectors/airbob-outbox-connector/status`,
  });
  const payload = await readJsonPayload(response);
  const connectorIsRunning = payload?.connector?.state === "RUNNING";
  const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
  const tasksAreRunning =
    tasks.length > 0 && tasks.every((task) => task?.state === "RUNNING");

  if (!connectorIsRunning || !tasksAreRunning) {
    throw new LocalIntegrationBlockedError("debezium connector is not ready");
  }
};

export const connectToLoopbackPort = ({
  port,
  timeoutMs = REQUEST_TIMEOUT_MS,
}) =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (error) => {
      socket.removeAllListeners();
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };

    socket.setTimeout(timeoutMs, () => finish(new Error("timeout")));
    socket.once("connect", () => finish());
    socket.once("error", finish);
  });

const checkDependencyPorts = async ({ connectImpl, ports }) => {
  for (const [name, port] of Object.entries(ports)) {
    try {
      await connectImpl({ port });
    } catch {
      throw new LocalIntegrationBlockedError(
        formatBlockedReason(`${name} dependency`, "is unreachable"),
      );
    }
  }
};

export const runLocalIntegrationPreflight = async ({
  configuration = null,
  environment = process.env,
  fetchImpl = globalThis.fetch,
  connectImpl = connectToLoopbackPort,
  requireToss = false,
} = {}) => {
  const resolvedConfiguration =
    configuration ??
    loadLocalIntegrationEnvironment({
      environment,
      requireToss,
    });

  await checkHttpReachability({
    fetchImpl,
    name: "frontend",
    url: resolvedConfiguration.appOrigin,
  });
  await checkBackendReadiness({
    fetchImpl,
    backend: resolvedConfiguration.backend,
  });
  await checkDependencyPorts({
    connectImpl,
    ports: resolvedConfiguration.backend.ports,
  });
  await checkElasticsearchAlias({
    fetchImpl,
    port: resolvedConfiguration.backend.ports.elasticsearch,
  });
  await checkDebeziumConnector({
    fetchImpl,
    port: resolvedConfiguration.backend.ports.debezium,
  });

  return Object.freeze({
    project: requireToss ? "local-toss-sandbox" : "local-core",
    status: "ready",
  });
};
