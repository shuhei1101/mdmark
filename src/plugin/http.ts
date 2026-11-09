import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { join } from "node:path";
import { Readable } from "node:stream";
import {
  createMcpHandler,
  hostHeaderValidationResponse,
  localhostAllowedHostnames,
  localhostAllowedOrigins,
  type McpHttpHandler,
  originValidationResponse,
} from "@modelcontextprotocol/server";
import { createMcpServer, describeServerLocation } from "./mcp.ts";
import {
  DEFAULT_PORT,
  INVALID_PORT_MESSAGE,
  PORT_ENV,
  readPort,
} from "./port.ts";
import {
  readSessionName,
  readUnitName,
  readYamlFile,
  resolveSetupPaths,
  SetupError,
} from "./setup/paths.ts";
import type { ServerRoots } from "./tools.ts";

export { DEFAULT_PORT, INVALID_PORT_MESSAGE, PORT_ENV, readPort };

/** 待ち受けるアドレス */
export const LISTEN_HOST = "127.0.0.1";

/** MCP の要求を受けるパス */
export const MCP_PATH = "/mcp";

/** 待ち受けるポートを別のプロセスが使用しているときに標準エラーに書き込む文。`{port}` をポートに置き換える */
export const PORT_IN_USE_MESSAGE =
  "ポート {port} は別のプロセスが使用しています。mdmark serve が既に起動しているなら、そのまま使用できます。別のポートで動かすときは、~/.claude/settings.json の env と mdmark serve を起動する環境の両方に同じ MDMARK_PORT を設定してください。";

/** 本文を持たない HTTP のメソッド */
const BODYLESS_METHODS = ["GET", "HEAD"];

/** 端末の設定を読み込む。読み込めなければ `undefined` にする（読み込めないことは `mdmark check` が通知する） */
async function readServeSettings(
  env: NodeJS.ProcessEnv,
): Promise<Record<string, unknown> | undefined> {
  try {
    const settings = await readYamlFile({
      path: resolveSetupPaths(env).settingsPath,
      readFile: (path) => readFile(path, "utf8"),
    });
    return settings?.raw;
  } catch (error) {
    if (error instanceof SetupError) {
      return undefined;
    }
    throw error;
  }
}

/** `MDMARK_LAUNCHER` と端末の設定の unit の名前・tmux のセッション名から、常駐サーバーが動いている場所の文を作る */
async function readServeLocation(env: NodeJS.ProcessEnv): Promise<string> {
  const settings = await readServeSettings(env);
  return describeServerLocation({
    launcher: env.MDMARK_LAUNCHER,
    unit: readUnitName(settings),
    session: readSessionName(settings),
  });
}

/** パス・Host・Origin を確認し、通った要求だけを MCP のハンドラーへ指定する。パスが違えば 404、Host か Origin が localhost でなければ 403 を返却する */
export async function routeRequest(options: {
  /** 組み込みの `Request` にした要求 */
  request: Request;
  /** `createMcpHandler` が返却したハンドラー */
  handler: McpHttpHandler;
}): Promise<Response> {
  const { request, handler } = options;
  if (new URL(request.url).pathname !== MCP_PATH) {
    return new Response("Not Found", { status: 404 });
  }
  const rejected =
    hostHeaderValidationResponse(request, localhostAllowedHostnames()) ??
    originValidationResponse(request, localhostAllowedOrigins());
  if (rejected !== undefined) {
    return rejected;
  }
  return handler.fetch(request);
}

/** `node:http` の要求を、メソッド・ヘッダー・本文を移した組み込みの `Request` にする */
export function toRequest(options: {
  /** 受けた要求 */
  req: IncomingMessage;
  /** 待ち受けているポート */
  port: number;
}): Request {
  const { req, port } = options;
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) {
        headers.append(name, item);
      }
    }
  }
  const method = req.method ?? "GET";
  const url = `http://${LISTEN_HOST}:${port}${req.url}`;
  if (BODYLESS_METHODS.includes(method)) {
    return new Request(url, { method, headers });
  }
  // 本文のストリームを指定するには `duplex: "half"` が要るが、DOM の型には無い
  const init: RequestInit & { duplex: "half" } = {
    method,
    headers,
    body: Readable.toWeb(req) as ReadableStream,
    duplex: "half",
  };
  return new Request(url, init);
}

/** 組み込みの `Response` のステータスとヘッダーを記載し、本文を読み込みながら `res` に実行して閉じる。実行している間に相手が切れたら本文を読み込むのをやめる */
export async function writeResponse(options: {
  /** 返却する応答 */
  response: Response;
  /** 書き込む先 */
  res: ServerResponse;
}): Promise<void> {
  const { response, res } = options;
  // 同じ名前のヘッダー（set-cookie）を別々の行で記載するため、名前と値の並びで指定する
  res.writeHead(response.status, [...response.headers].flat());
  if (response.body === null) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  res.once("close", () => void reader.cancel());
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    res.write(value);
  }
  res.end();
}

/** 要求を変換して振り分け、応答を記載する。想定しない例外は標準エラーに書き込み、その要求だけを 500 にする */
async function respond(options: {
  handler: McpHttpHandler;
  req: IncomingMessage;
  res: ServerResponse;
  port: number;
  stderr: (line: string) => void;
}): Promise<void> {
  const { handler, req, res, port, stderr } = options;
  try {
    const response = await routeRequest({
      request: toRequest({ req, port }),
      handler,
    });
    await writeResponse({ response, res });
  } catch (error) {
    stderr(
      `[error] ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
    );
    if (!res.headersSent) {
      res.writeHead(500);
    }
    res.end();
  }
}

/** `mdmark serve` の本体。`LISTEN_HOST` の `MCP_PATH` で待ち受け、`signal` が止める合図になったら閉じて 0 を返却する。ポートが使用されていれば理由を標準エラーに書き込んで 1 を返却する */
export async function runServe(options: {
  /** 環境変数 */
  env: NodeJS.ProcessEnv;
  /** `mdmark serve` を起動したパッケージの直下 */
  packageDir: string;
  /** mdmark のバージョン */
  version: string;
  /** 止める合図 */
  signal: AbortSignal;
  /** 標準出力へ 1 行書く */
  stdout: (line: string) => void;
  /** 標準エラーへ 1 行書く */
  stderr: (line: string) => void;
}): Promise<0 | 1> {
  const { env, packageDir, version, signal, stdout, stderr } = options;
  const port = readPort({ env });
  const roots: ServerRoots = {
    distDir: join(packageDir, "dist"),
  };
  const serverLocation = await readServeLocation(env);
  // 要求ごとに MCP サーバーを作る（セッションの状態を持たない）
  const handler = createMcpHandler(
    () => createMcpServer({ roots, version, serverLocation, stderr }),
    { onerror: (error) => stderr(`[error] ${error.message}`) },
  );
  const server = createServer((req, res) => {
    void respond({ handler, req, res, port, stderr });
  });
  const listening = await new Promise<"listening" | "in_use">(
    (resolve, reject) => {
      server.once("error", (error: NodeJS.ErrnoException) =>
        error.code === "EADDRINUSE" ? resolve("in_use") : reject(error),
      );
      server.listen(port, LISTEN_HOST, () => resolve("listening"));
    },
  );
  if (listening === "in_use") {
    stderr(PORT_IN_USE_MESSAGE.replace("{port}", String(port)));
    return 1;
  }
  stdout(
    `MCP サーバーを起動しました: http://${LISTEN_HOST}:${port}${MCP_PATH}`,
  );
  await new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    signal.addEventListener("abort", () => resolve(), { once: true });
  });
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    // つないだままの接続（通知の待ち受け）で閉じるのが止まらないようにする
    server.closeAllConnections();
  });
  return 0;
}
