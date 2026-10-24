import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { runTests } from "@vscode/test-electron";
import { createBuiltRoot } from "../../../tests/integration/built-root.ts";
import { createStubServer } from "./stub-server.ts";

/** 結合テストを流す VS Code: 対応する下限と、その時点の stable */
export const TEST_VSCODE_VERSIONS = ["1.141.0", "stable"];

/** 拡張機能の場所（`vscode/`）とリポジトリの直下 */
const EXTENSION_PATH = resolve(import.meta.dirname, "..", "..");

/** 127.0.0.1 の空きポートで待ち受け、そのポートを返す */
async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolveListen) => {
    server.listen(0, "127.0.0.1", resolveListen);
  });
  return (server.address() as AddressInfo).port;
}

/** 代役の配信（このブランチでビルドした mdmark の配布物とタグ一覧）を立て、`TEST_VSCODE_VERSIONS` のそれぞれで `runTests` を呼ぶ */
export async function runIntegrationTests(): Promise<void> {
  const stub: Parameters<typeof createStubServer>[0] = {
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
