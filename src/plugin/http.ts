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
import { CliError } from "../cli/errors.ts";
import { createMcpServer } from "./mcp.ts";
import type { ServerRoots } from "./tools.ts";

/** 待ち受けるポートを上書きする環境変数の名前。`plugin/.mcp.json` の `url` も同じ名前で展開する */
export const PORT_ENV = "MDMARK_PORT";

/** `PORT_ENV` が無いときに待ち受けるポート */
export const DEFAULT_PORT = 8782;

/** 待ち受けるアドレス */
export const LISTEN_HOST = "127.0.0.1";

/** MCP の要求を受けるパス */
export const MCP_PATH = "/mcp";

/** `PORT_ENV` が 1〜65535 の整数でないときの `CliError` の文。`{value}` を受け取った値に置き換える */
export const INVALID_PORT_MESSAGE =
  "MDMARK_PORT の値 {value} はポートに使えません。1〜65535 の整数を設定してください。";

/** 待ち受けるポートを別のプロセスが使っているときに標準エラーに書く文。`{port}` をポートに置き換える */
export const PORT_IN_USE_MESSAGE =
  "ポート {port} は別のプロセスが使っています。mdmark serve が既に起動しているなら、そのまま使えます。別のポートで動かすときは、~/.claude/settings.json の env と mdmark serve を起動する環境の両方に同じ MDMARK_PORT を設定してください。";

/** ポートに使える最小の値と最大の値 */
const MIN_PORT = 1;
const MAX_PORT = 65535;

/** 本文を持たない HTTP のメソッド */
const BODYLESS_METHODS = ["GET", "HEAD"];

/** 待ち受けるポートを決める。`PORT_ENV` が無いか空なら `DEFAULT_PORT`、1〜65535 の整数ならその数、それ以外は `CliError` を投げる */
export function readPort(options: { env: NodeJS.ProcessEnv }): number {
  const value = options.env[PORT_ENV];
  if (value === undefined || value === "") {
    return DEFAULT_PORT;
  }
  const port = Number(value);
  if (!/^\d+$/.test(value) || port < MIN_PORT || port > MAX_PORT) {
    throw new CliError(INVALID_PORT_MESSAGE.replace("{value}", value));
  }
  return port;
}

/** パス・Host・Origin を確かめ、通った要求だけを MCP のハンドラーへ渡す。パスが違えば 404、Host か Origin が localhost でなければ 403 を返す */
export async function routeRequest(options: {
  /** 組み込みの `Request` にした要求 */
  request: Request;
  /** `createMcpHandler` が返したハンドラー */
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
  // 本文のストリームを渡すには `duplex: "half"` が要るが、DOM の型には無い
  const init: RequestInit & { duplex: "half" } = {
    method,
    headers,
    body: Readable.toWeb(req) as ReadableStream,
    duplex: "half",
  };
  return new Request(url, init);
}

/** 組み込みの `Response` のステータスとヘッダーを書き、本文を読みながら `res` に流して閉じる。流している間に相手が切れたら本文を読むのをやめる */
export async function writeResponse(options: {
  /** 返す応答 */
  response: Response;
  /** 書き込む先 */
  res: ServerResponse;
}): Promise<void> {
  const { response, res } = options;
  // 同じ名前のヘッダー（set-cookie）を別々の行で書くため、名前と値の並びで渡す
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

/** 要求を変換して振り分け、応答を書く。想定しない例外は標準エラーに書き、その要求だけを 500 にする */
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

/** `mdmark serve` の本体。`LISTEN_HOST` の `MCP_PATH` で待ち受け、`signal` が止める合図になったら閉じて 0 を返す。ポートが使われていれば理由を標準エラーに書いて 1 を返す */
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
    guideDir: join(packageDir, "plugin", "guide"),
    distDir: join(packageDir, "dist"),
  };
  // 要求ごとに MCP サーバーを作る（セッションの状態を持たない）
  const handler = createMcpHandler(
    () => createMcpServer({ roots, version, stderr }),
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
