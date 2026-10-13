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
