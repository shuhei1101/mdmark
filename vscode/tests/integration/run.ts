import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { runTests } from "@vscode/test-electron";
import { createBuiltRoot } from "../../../tests/integration/built-root.ts";

/** 結合テストを流す VS Code: 対応する下限と、その時点の stable */
export const TEST_VSCODE_VERSIONS = ["1.141.0", "stable"];

/** 拡張機能の場所（`vscode/`）とリポジトリの直下 */
const EXTENSION_PATH = resolve(import.meta.dirname, "..", "..");

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
  /** 受けた要求の経路（`/tags` と `/@{バージョン}/dist/{ファイル}`） */
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

/** 代役の配信を `127.0.0.1` の空きポートで立てる。配布物とタグ一覧に加えて、テストが状態を切り替える `PUT /tags`・`PUT /mode` と、受けた要求を読む `GET /requests`・`DELETE /requests` を持つ */
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

/** 127.0.0.1 の空きポートで待ち受け、そのポートを返す */
async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolveListen) => {
    server.listen(0, "127.0.0.1", resolveListen);
  });
  return (server.address() as AddressInfo).port;
}

/** 代役の配信（このブランチでビルドした mdmark の配布物とタグ一覧）を立て、`TEST_VSCODE_VERSIONS` のそれぞれで `runTests` を呼ぶ */
export async function runIntegrationTests(): Promise<void> {
  const stub: Stub = {
    tags: ["v0.10.0"],
    mode: { tags: "ok", dist: "ok" },
    requests: [],
  };
  // 配布物は、このブランチのソースを一時フォルダにビルドして配る（`dist/` は書き換えない）
  const built = await createBuiltRoot();
  const server = createStubServer(stub, join(built.root, "dist"));
  const port = await listen(server);
  const origin = `http://127.0.0.1:${port}`;
  // 見本のワークスペース: 見出し・表・注意書きを持つ `guide.md`
  const workspacePath = await mkdtemp(join(tmpdir(), "mdmark-vscode-"));
  await mkdir(join(workspacePath, "docs"));
  await writeFile(
    join(workspacePath, "docs", "guide.md"),
    "# 見出し\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n> [!NOTE]\n> 注意書き\n",
  );
  try {
    for (const version of TEST_VSCODE_VERSIONS) {
      // 前回のバージョン（`globalState`）が空の状態で始めるため、バージョンごとに新しいユーザーデータを使う
      const userDataDir = await mkdtemp(join(tmpdir(), "mdmark-vscode-user-"));
      await runTests({
        version,
        extensionDevelopmentPath: EXTENSION_PATH,
        extensionTestsPath: join(EXTENSION_PATH, "out", "test", "index.mjs"),
        launchArgs: [
          workspacePath,
          "--disable-extensions",
          `--user-data-dir=${userDataDir}`,
        ],
        extensionTestsEnv: {
          MDMARK_VSCODE_DIST_BASE: `${origin}/mdmark`,
          MDMARK_VSCODE_TAGS_URL: `${origin}/tags`,
          // 子プロセスの npm が、この入口と同じ Node を使うようにする
          MDMARK_TEST_NODE_DIR: dirname(process.execPath),
        },
      });
      await rm(userDataDir, { recursive: true, force: true });
    }
  } finally {
    server.close();
    await rm(workspacePath, { recursive: true, force: true });
    await built.dispose();
  }
}

// `node tests/integration/run.ts` で入口として実行されたときだけ流す。どれかが落ちたら終了コードを 1 にする
if (import.meta.main) {
  runIntegrationTests().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
