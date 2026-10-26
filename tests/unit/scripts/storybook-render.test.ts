import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";

/** 描画の口のスクリプトを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadRender = () => import("../../../scripts/storybook-render.ts");

/** 知らせの枠の処理を読み込む */
const loadNotice = () => import("../../../src/parts/notice.ts");

/** 読み込み中の枠の処理を読み込む */
const loadEmbed = () => import("../../../src/parts/embed.ts");

/** 表の処理を読み込む */
const loadTable = () => import("../../../src/parts/table.ts");

/** 文書の一覧の処理を読み込む */
const loadDocList = () => import("../../../src/parts/doc-list.ts");

/** VS Code 拡張機能のプレビューの状態の表示の処理を読み込む */
const loadPreviewStatus = () =>
  import("../../../vscode/src/webview/parts/preview-status.ts");

const servers: Server[] = [];
const createdRoots: string[] = [];

/** 一時フォルダに作業ツリーの代わりを作り、css があれば src/index.css に置く */
async function createRoot(css?: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mdmark-render-"));
  createdRoots.push(root);
  if (css !== undefined) {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "index.css"), css);
  }
  return root;
}

/** 127.0.0.1 の空きポートで待ち受け、そのポートを返す */
async function listen(server: Server): Promise<number> {
  servers.push(server);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  return (server.address() as AddressInfo).port;
}

/** 標準エラーへの出力を集め、集めた文字列を返す関数を返す */
function captureStderr(): () => string {
  const chunks: string[] = [];
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
    chunks.push(String(chunk));
    return true;
  });
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    chunks.push(args.join(" "));
  });
  return () => chunks.join("\n");
}

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  process.exitCode = undefined;
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
  await Promise.all(
    createdRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

// 知らせの枠を引数どおりに描く（正常系）
test("test_render_part_when_notice", async () => {
  // 準備
  const { renderPart } = await loadRender();
  const { renderNotice } = await loadNotice();
  const params = new URLSearchParams("name=tabs&figure=false");
  // 実行
  const html = renderPart({ component: "notice", params });
  // 検証
  expect(html).toBe(
    `<div class="mdmark">${renderNotice({ name: "tabs", figure: false })}</div>`,
  );
});

// カンマで結ばれた引数を配列に戻して読み込み中の枠を描く（正常系）
test("test_render_part_when_embed", async () => {
  // 準備
  const { renderPart } = await loadRender();
  const { renderEmbed } = await loadEmbed();
  const params = new URLSearchParams("name=chart&args=a,b");
  // 実行
  const html = renderPart({ component: "embed", params });
  // 検証
  expect(html).toBe(
    `<div class="mdmark">${renderEmbed({ name: "chart", args: ["a", "b"] })}</div>`,
  );
});

// JSON の引数を戻して表を描く（正常系）
test("test_render_part_when_json_args", async () => {
  // 準備
  const { renderPart } = await loadRender();
  const { renderTable } = await loadTable();
  const params = new URLSearchParams({
    features: '["sort"]',
    columns: '["A"]',
    rows: '[["1"]]',
    sort: '{"column":0,"direction":"ascending"}',
  });
  // 実行
  const html = renderPart({ component: "table", params });
  // 検証
  expect(html).toBe(
    `<div class="mdmark">${renderTable({
      features: ["sort"],
      columns: ["A"],
      rows: [["1"]],
      sort: { column: 0, direction: "ascending" },
    })}</div>`,
  );
});

// JSON の引数を戻して文書の一覧を描く（正常系）
test("test_render_part_when_doc_list", async () => {
  // 準備
  const { renderPart } = await loadRender();
  const { renderDocList } = await loadDocList();
  const docs = [
    { path: "README.md", title: "入口" },
    { path: "使い方/guide.md", title: "使い方" },
  ];
  const params = new URLSearchParams({
    docs: JSON.stringify(docs),
    current: "使い方/guide.md",
  });
  // 実行
  const html = renderPart({ component: "doc-list", params });
  // 検証
  expect(html).toBe(
    `<div class="mdmark">${renderDocList({ docs, current: "使い方/guide.md" })}</div>`,
  );
});

// 拡張機能のプレビューの状態の表示を引数どおりに描く（正常系）
test("test_render_part_when_vscode_part", async () => {
  // 準備
  const { renderPart } = await loadRender();
  const { renderPreviewStatus } = await loadPreviewStatus();
  const params = new URLSearchParams("state=versionMissing&version=v9.9.9");
  // 実行
  const html = renderPart({ component: "preview-status", params });
  // 検証
  expect(html).toBe(
    `<div class="mdmark">${renderPreviewStatus({ state: "versionMissing", version: "v9.9.9" })}</div>`,
  );
});

// highlight が true のコードブロックを色分けして返す（正常系）
test("test_render_part_when_code_block_highlighted", async () => {
  // 準備
  const { renderPart } = await loadRender();
  const lines = [{ text: "const a = 1;" }, { text: "// b" }];
  const params = new URLSearchParams({
    language: "ts",
    title: "",
    lineNumbers: "true",
    highlight: "true",
    lines: JSON.stringify(lines),
  });
  // 実行
  const html = renderPart({ component: "code-block", params });
  // 検証
  const texts = (html ?? "").split('<span class="mdmark-code-text">').slice(1);
  expect(texts).toHaveLength(2);
  expect(texts[0]).toContain('<span class="hljs-keyword">const</span>');
  expect(texts[1]).toContain('<span class="hljs-comment">// b</span>');
  expect(texts.map((text) => text.replace(/<[^>]*>/g, "").trim())).toEqual(
    lines.map((line) => line.text),
  );
});

// 知らない部品は返さない（正常系）
test("test_render_part_when_unknown", async () => {
  // 準備
  const { renderPart } = await loadRender();
  // 実行
  const html = renderPart({
    component: "missing",
    params: new URLSearchParams(),
  });
  // 検証
  expect(html).toBeUndefined();
});

// 部品の HTML を 200 で返す（正常系）
test("test_create_render_server", async () => {
  // 準備
  const { createRenderServer } = await loadRender();
  const port = await listen(createRenderServer({ root: await createRoot() }));
  // 実行
  const response = await fetch(
    `http://127.0.0.1:${port}/render/notice?name=chart&figure=true`,
  );
  // 検証
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(await response.text()).toContain("この図を表示できません");
});

// 本文の CSS を返す（正常系）
test("test_create_render_server_when_css", async () => {
  // 準備
  const { createRenderServer } = await loadRender();
  const css = ".mdmark { color: red; }\n";
  const port = await listen(
    createRenderServer({ root: await createRoot(css) }),
  );
  // 実行
  const response = await fetch(`http://127.0.0.1:${port}/render/index.css`);
  // 検証
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("text/css; charset=utf-8");
  expect(await response.text()).toBe(css);
});

// 知らない部品は 404 を返す（正常系）
test("test_create_render_server_when_unknown_part", async () => {
  // 準備
  const { createRenderServer } = await loadRender();
  const port = await listen(createRenderServer({ root: await createRoot() }));
  // 実行
  const response = await fetch(`http://127.0.0.1:${port}/render/missing`);
  // 検証
  expect(response.status).toBe(404);
  expect(await response.text()).toContain("missing");
});

// ポートが無ければ待ち受けずに終わる（異常系）
test("test_main_when_port_missing", async () => {
  // 準備
  const { main } = await loadRender();
  vi.stubEnv("RENDER_PORT", undefined);
  const stderr = captureStderr();
  // 実行
  await main();
  // 検証
  expect(process.exitCode).toBe(1);
  expect(stderr()).toContain("RENDER_PORT");
});
