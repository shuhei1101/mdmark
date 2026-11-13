#!/usr/bin/env node
import { createRequire as __createRequire } from "node:module";
const require = __createRequire(import.meta.url);

// src/cli/errors.ts
var CliError = class extends Error {
};

// src/plugin/port.ts
import { connect } from "node:net";
var CONNECT_TIMEOUT_MS = 1e3;
var PROBE_HOST = "127.0.0.1";
var isPortListening = (options) => new Promise((resolve) => {
  const socket = connect({ host: PROBE_HOST, port: options.port });
  const finish = (listening) => {
    socket.destroy();
    resolve(listening);
  };
  socket.setTimeout(options.timeoutMs, () => finish(false));
  socket.once("connect", () => finish(true));
  socket.once("error", () => finish(false));
});
var PORT_ENV = "MDMARK_PORT";
var DEFAULT_PORT = 8782;
var INVALID_PORT_MESSAGE = "MDMARK_PORT \u306E\u5024 {value} \u306F\u30DD\u30FC\u30C8\u306B\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093\u30021\u301C65535 \u306E\u6574\u6570\u3092\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002";
var MIN_PORT = 1;
var MAX_PORT = 65535;
function readPort(options) {
  const value = options.env[PORT_ENV];
  if (value === void 0 || value === "") {
    return DEFAULT_PORT;
  }
  const port = Number(value);
  if (!/^\d+$/.test(value) || port < MIN_PORT || port > MAX_PORT) {
    throw new CliError(INVALID_PORT_MESSAGE.replace("{value}", value));
  }
  return port;
}

// src/plugin/session-start.ts
var NOT_LISTENING_CONTEXT = "mdmark \u306E MCP \u306E\u5E38\u99D0\u30B5\u30FC\u30D0\u30FC\u304C 127.0.0.1:{port} \u3067\u5F85\u3061\u53D7\u3051\u3066\u3044\u306A\u3044\u305F\u3081\u3001mdmark \u306E MCP \u306E\u30C4\u30FC\u30EB\u306F\u4F7F\u7528\u3067\u304D\u306A\u3044\u3002/mdmark:global-setup \u3067\u8D77\u52D5\u3067\u304D\u308B\u3002";
var PORT_INVALID_CONTEXT = "MDMARK_PORT \u306E\u5024 {value} \u306F\u30DD\u30FC\u30C8\u3068\u3057\u3066\u4F7F\u7528\u3067\u304D\u306A\u3044\u305F\u3081\u3001mdmark \u306E MCP \u306E\u30C4\u30FC\u30EB\u306F\u4F7F\u7528\u3067\u304D\u306A\u3044\u30021\u301C65535 \u306E\u6574\u6570\u3092\u8A2D\u5B9A\u3059\u308B\u3002";
var writeContext = (stdout, context) => {
  stdout(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: context
      }
    })
  );
};
var runSessionStart = async (options) => {
  let port;
  try {
    port = readPort({ env: options.env });
  } catch (error) {
    if (error instanceof CliError) {
      writeContext(
        options.stdout,
        PORT_INVALID_CONTEXT.replace("{value}", options.env.MDMARK_PORT ?? "")
      );
      return 0;
    }
    throw error;
  }
  if (await isPortListening({ port, timeoutMs: CONNECT_TIMEOUT_MS })) {
    return 0;
  }
  writeContext(
    options.stdout,
    NOT_LISTENING_CONTEXT.replace("{port}", String(port))
  );
  return 0;
};
if (import.meta.main) {
  process.exitCode = await runSessionStart({
    env: process.env,
    stdout: (line) => console.log(line)
  });
}
export {
  NOT_LISTENING_CONTEXT,
  PORT_INVALID_CONTEXT,
  runSessionStart
};
