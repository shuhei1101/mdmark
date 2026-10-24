import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { extname, join, normalize } from "node:path";

/** 配布物の拡張子ごとの `Content-Type` */
const CONTENT_TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

/** テストが `PUT /mode` で切り替える代役の振る舞い */
type Mode = {
  /** タグ一覧: 通常・応答しない・403 */
  tags: "ok" | "hang" | "forbidden";
  /** 配布物: 通常・接続を切る（オフライン）・`SLOW_DIST_MS` 遅らせて返す */
  dist: "ok" | "drop" | "slow";
};

/** 代役の配信が受けた要求と、テストが切り替える状態 */
type Stub = {
  /** タグ一覧 */
  tags: string[];
  /** 振る舞い */
  mode: Mode;
  /** 受けた要求の経路（`/tags` と `/mdmark@{バージョン}/dist/{ファイル}`） */
  requests: string[];
};

/** 要求の本文を JSON として読む */
async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

/** 応答を JSON で返す */
function sendJson(response: ServerResponse, body: unknown): void {
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

/** 配布物を遅らせて返すときの遅れ（ミリ秒）。読み込み中の表示を出す 1 秒より長くする */
const SLOW_DIST_MS = 6000;

/** 配布物が無いバージョン: `@v9.9.9` の配布物には 404 を返す */
const MISSING_VERSION = "v9.9.9";

/** 配布物の経路 `/mdmark@{バージョン}/dist/{ファイル}` を、どのバージョンでも `distDir` のファイルに引く。`MISSING_VERSION` だけ 404 を返す */
async function serveDist(
  path: string,
  distDir: string,
  response: ServerResponse,
): Promise<void> {
  const match = /^\/mdmark@(v[^/]+)\/dist\/([^/]+)$/.exec(path);
  const file = match?.[2];
  if (match === null || file === undefined || match[1] === MISSING_VERSION) {
    response.writeHead(404);
    response.end();
    return;
  }
  const target = normalize(join(distDir, file));
  if (!target.startsWith(distDir)) {
    response.writeHead(404);
    response.end();
    return;
  }
  try {
    const body = await readFile(target);
    // Webview が前のテストで読んだ配布物を使い回さないよう、キャッシュさせない
    response.writeHead(200, {
      "Content-Type":
        CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
}

/** 待ち受けを始めていない代役の配信のサーバーを作る。配布物とタグ一覧に加えて、テストが状態を切り替える `PUT /tags`・`PUT /mode` と、受けた要求を読む `GET /requests`・`DELETE /requests` を持つ */
export function createStubServer(stub: Stub, distDir: string): Server {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;
    if (path === "/requests") {
      if (request.method === "DELETE") {
        stub.requests.length = 0;
      }
      sendJson(response, stub.requests);
      return;
    }
    if (path === "/mode" && request.method === "PUT") {
      stub.mode = (await readJson(request)) as Mode;
      sendJson(response, stub.mode);
      return;
    }
    if (path === "/tags" && request.method === "PUT") {
      stub.tags = (await readJson(request)) as string[];
      sendJson(response, stub.tags);
      return;
    }
    if (path === "/tags") {
      stub.requests.push(path);
      if (stub.mode.tags === "hang") {
        return;
      }
      if (stub.mode.tags === "forbidden") {
        response.writeHead(403);
        response.end();
        return;
      }
      sendJson(
        response,
        stub.tags.map((name) => ({ name })),
      );
      return;
    }
    stub.requests.push(path);
    if (stub.mode.dist === "drop") {
      request.socket.destroy();
      return;
    }
    if (stub.mode.dist === "slow") {
      await new Promise((resolveWait) => setTimeout(resolveWait, SLOW_DIST_MS));
    }
    // ブラウザの配布物の読み込みは別のオリジンのため、CORS を許す
    response.setHeader("Access-Control-Allow-Origin", "*");
    await serveDist(path, distDir, response);
  });
}
