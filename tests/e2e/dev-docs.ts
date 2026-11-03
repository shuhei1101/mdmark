import { type ChildProcess, spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { parse } from "yaml";
import { findFreePort, isListening } from "./plugin.ts";

/** `search_docs` が返した文書の 1 件 */
export type DevDocsItem = {
  /** 文書の ID（配信元のリポジトリの直下からのパス） */
  id: string;
  /** 指定した項目の値（`view: "full"` では `body` に本文） */
  values: Record<string, unknown>;
};

/** このリポジトリの直下 */
export const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
/** このリポジトリを登録する配信元の ID */
export const DEV_DOCS_SOURCE = "mdmark";
/** 使い方集のページを `docs` の行とタグで絞る条件 */
export const GUIDE_FILTER = {
  and: [
    { field: "tags", op: "eq", values: ["topic:使い方集"] },
    { field: "kind", op: "eq", values: ["docs"] },
  ],
};

// dev-docs のクローンの場所を指す環境変数
const CLONE_ENV = "DEV_DOCS_CLONE";
// dev-docs の端末の設定の既定の場所
const DEFAULT_SETTINGS = join(
  homedir(),
  ".config",
  "dev-docs",
  "settings.yaml",
);
// 待ち受けるアドレス
const LISTEN_HOST = "127.0.0.1";
// MCP のエンドポイントのパス
const MCP_PATH = "/mcp";
// 待ち受けを始めたかを確かめる間隔（ミリ秒）
const POLL_INTERVAL_MS = 200;
// ポートが使用中のときの dev-docs の終了コード
const PORT_IN_USE_CODE = 3;
// 空きを確かめたポートを別のプロセスに取られたときの、起動し直す回数の上限
const MAX_START_ATTEMPTS = 5;
// 1 回の検索で返す件数の上限
const SEARCH_LIMIT = 100;

/** dev-docs のクローンの場所。`DEV_DOCS_CLONE` が無ければ、端末の設定の `clone` を使う */
async function findClone(): Promise<string> {
  const fromEnv = process.env[CLONE_ENV];
  if (fromEnv !== undefined && fromEnv !== "") {
    return fromEnv;
  }
  const settings = parse(await readFile(DEFAULT_SETTINGS, "utf8")) as {
    clone?: unknown;
  };
  if (typeof settings.clone !== "string") {
    throw new Error(`${DEFAULT_SETTINGS} に clone が無い`);
  }
  return settings.clone;
}

/** このリポジトリだけを配信元 `mdmark` として登録した端末の設定を `dir` に書き、そのパスを返す */
async function writeSettings(options: {
  dir: string;
  clone: string;
}): Promise<string> {
  const { dir, clone } = options;
  const path = join(dir, "dev-docs-settings.yaml");
  await writeFile(
    path,
    [
      'version: "1"',
      `clone: ${JSON.stringify(clone)}`,
      "sources:",
      `  - id: ${DEV_DOCS_SOURCE}`,
      `    config: ${JSON.stringify(join(REPO_ROOT, "dev-docs.yaml"))}`,
      "    scope:",
      `      read: [${JSON.stringify(`${REPO_ROOT}/**`)}]`,
      "",
    ].join("\n"),
  );
  return path;
}

/** 子プロセスが動いているか */
function isAlive(child: ChildProcess): boolean {
  return child.exitCode === null && child.signalCode === null;
}

/** dev-docs を `port` で起動し、待ち受けを始めるまで待つ。先に終わったときは終了コードを返す */
async function startDevDocs(options: {
  clone: string;
  settings: string;
  port: number;
}): Promise<{ child: ChildProcess; exited: Promise<number> } | number> {
  const { clone, settings, port } = options;
  const child = spawn(
    join(clone, ".venv", "bin", "python"),
    ["-m", "dev_docs", "serve"],
    {
      cwd: clone,
      env: {
        ...process.env,
        DEV_DOCS_CONFIG: settings,
        DEV_DOCS_PORT: String(port),
      },
      stdio: "ignore",
    },
  );
  const exited = new Promise<number>((resolve) => {
    child.once("close", (code) => resolve(code ?? -1));
  });
  // 待ち受けを始めるか、先に終わるまで確かめ続ける
  while (isAlive(child)) {
    if (await isListening(port)) {
      return { child, exited };
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return exited;
}

/** 一時フォルダ `dir` の端末の設定でこのリポジトリを登録した dev-docs を空きポートで起動し、つないだクライアントを `use` に渡す。終わったら閉じて止める */
export async function withDevDocs<T>(
  dir: string,
  use: (client: Client) => Promise<T>,
): Promise<T> {
  const clone = await findClone();
  const settings = await writeSettings({ dir, clone });
  let started: { child: ChildProcess; exited: Promise<number> } | undefined;
  let port = 0;
  // 空きを確かめてから起動するまでに別のプロセスにポートを取られたときは、ポートを選び直す
  for (let attempt = 1; started === undefined; attempt++) {
    port = await findFreePort();
    const result = await startDevDocs({ clone, settings, port });
    if (typeof result !== "number") {
      started = result;
    } else if (result !== PORT_IN_USE_CODE || attempt >= MAX_START_ATTEMPTS) {
      throw new Error(
        `dev-docs が待ち受ける前に終わった（終了コード ${result}）`,
      );
    }
  }
  const client = new Client({ name: "e2e", version: "0.0.0" });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL(`http://${LISTEN_HOST}:${port}${MCP_PATH}`),
      ),
    );
    return await use(client);
  } finally {
    await client.close();
    if (isAlive(started.child)) {
      started.child.kill("SIGINT");
    }
    await started.exited;
  }
}

/** 配信元 `mdmark` を、作業場所をこのリポジトリにして `search_docs` で検索し、文書の一覧を返す */
export async function searchDocs(
  client: Client,
  args: Record<string, unknown>,
): Promise<DevDocsItem[]> {
  const result = await client.callTool({
    name: "search_docs",
    arguments: {
      source: DEV_DOCS_SOURCE,
      cwd: REPO_ROOT,
      format: "json",
      limit: SEARCH_LIMIT,
      ...args,
    },
  });
  if (result.isError === true) {
    throw new Error(
      `search_docs が失敗した: ${JSON.stringify(result.content)}`,
    );
  }
  return (result.structuredContent as { items: DevDocsItem[] }).items;
}
