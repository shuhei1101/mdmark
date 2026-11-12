import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, test, vi } from "vitest";

/** 描画のインターフェースのスクリプトを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadRender = () => import("../../../scripts/storybook-render.ts");

/** 通知ブロックの処理を読み込む */
const loadNotice = () => import("../../../src/parts/notice.ts");

/** 読み込み中のブロックの処理を読み込む */
const loadEmbed = () => import("../../../src/parts/embed.ts");

/** 表の処理を読み込む */
const loadTable = () => import("../../../src/parts/table.ts");

/** 文書の一覧の処理を読み込む */
const loadDocList = () => import("../../../src/parts/doc-list.ts");

/** コメントの部品の処理を読み込む */
const loadComment = () => import("../../../src/parts/comment.ts");

/** バッジの処理を読み込む */
const loadBadge = () => import("../../../src/parts/badge.ts");

/** VS Code 拡張機能のプレビューの状態の表示の処理を読み込む */
const loadMediaError = () =>
  import("../../../vscode/src/webview/shared/lib/media-error.ts");

const servers: Server[] = [];
const createdRoots: string[] = [];

/** 一時フォルダに作業ツリーの代わりを作り、css があれば src/index.css に配置する */
async function createRoot(css?: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "mdmark-render-"));
  createdRoots.push(root);
  if (css !== undefined) {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "index.css"), css);
  }
  return root;
}

/** 127.0.0.1 の空きポートで待ち受け、そのポートを返却する */
async function listen(server: Server): Promise<number> {
  servers.push(server);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  return (server.address() as AddressInfo).port;
}

/** 標準エラーへの出力を集め、集めた文字列を返却する関数を返却する */
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

// 通知ブロックを引数どおりに描く（正常系）
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

// JSON の引数を戻して読み込み中のブロックを描く（正常系）
test("test_render_part_when_embed", async () => {
  // 準備
  const { renderPart } = await loadRender();
  const { renderEmbed } = await loadEmbed();
  const params = new URLSearchParams('name=chart&options={"items":["a","b"]}');
  // 実行
  const html = renderPart({ component: "embed", params });
  // 検証
  expect(html).toBe(
    `<div class="mdmark">${renderEmbed({ name: "chart", options: { items: ["a", "b"] } })}</div>`,
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
    { path: "使い方/guide.md", title: "使用方法" },
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

// 拡張機能の再生できない動画・音声の通知を引数どおりに描く（正常系）
test("test_render_part_when_vscode_part", async () => {
  // 準備
  const { renderPart } = await loadRender();
  const { renderMediaError } = await loadMediaError();
  const params = new URLSearchParams(
    "kind=video&format=webm&path=media/demo.webm",
  );
  // 実行
  const html = renderPart({ component: "media-error", params });
  // 検証
  expect(html).toBe(
    `<div class="mdmark">${renderMediaError({ kind: "video", format: "webm", path: "media/demo.webm" })}</div>`,
  );
});

// highlight が true のコードブロックを色分けして返却する（正常系）
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

// コメントの吹き出しを、描く先の要素の内側に収める style を付けて描く（正常系）
test("test_render_part_when_comment_popover", async () => {
  // 準備
  const { renderPart } = await loadRender();
  const { renderCommentBubble } = await loadComment();
  const params = new URLSearchParams({
    quote: "テーマの変数",
    bodies: JSON.stringify(["本文"]),
  });
  // 実行
  const html = renderPart({ component: "comment-bubble", params });
  // 検証
  expect(html).toBe(
    `<div class="mdmark"><style>.mdmark-comment-add,.mdmark-comment-popover{position:static;max-width:100%}</style>${renderCommentBubble({ quote: "テーマの変数", bodies: ["本文"] })}</div>`,
  );
});

// `frameWidth` の幅の枠を、描く先の要素の幅で頭打ちにして包む（正常系）
test("test_render_part_when_frame_width", async () => {
  // 準備
  const { renderPart } = await loadRender();
  const { renderBadge } = await loadBadge();
  const params = new URLSearchParams({ label: "v1", frameWidth: "390px" });
  // 実行
  const html = renderPart({ component: "badge", params });
  // 検証
  expect(html).toBe(
    `<div class="mdmark"><div style="width: 390px; max-width: 100%">${renderBadge({ label: "v1" })}</div></div>`,
  );
});

// 見本の SVG のファイルを読み込み、図の枠で包んで描く（正常系）
test("test_render_part_when_mermaid_diagram", async () => {
  // 準備
  const { renderPart } = await loadRender();
  const params = new URLSearchParams({
    svg: "flowchart",
    title: "問い合わせの受付",
  });
  const missing = new URLSearchParams({ svg: "missing", title: "x" });
  // 実行
  const html = renderPart({ component: "mermaid-diagram", params });
  const none = renderPart({ component: "mermaid-diagram", params: missing });
  // 検証
  expect(html).toContain('data-diagram="mermaid"');
  expect(html).toMatch(
    /<figure class="mdmark-diagram"[\s\S]*<svg[\s\S]*<\/figure>/,
  );
  expect(none).toBeUndefined();
});

// 知らない部品は返却しない（正常系）
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

// 部品の HTML を 200 で返却する（正常系）
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

// 本文の CSS を返却する（正常系）
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

// 見出し行と集計の行を留める処理をまとめて返却する（正常系）
test("test_create_render_server_when_sticky_script", async () => {
  // 準備
  const { createRenderServer } = await loadRender();
  const root = resolve(import.meta.dirname, "../../..");
  const port = await listen(createRenderServer({ root }));
  // 実行
  const response = await fetch(`http://127.0.0.1:${port}/render/sticky.js`);
  // 検証
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe(
    "text/javascript; charset=utf-8",
  );
  expect(await response.text()).toContain("attachStickyRows");
});

// 知らない部品は 404 を返却する（正常系）
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
