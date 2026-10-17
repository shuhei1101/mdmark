import { expect, test } from "vitest";

/** URL の # を読む処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadRoute = () => import("../../../../src/viewer/route.ts");

const ENTRY = "README.md";
const PATHS: ReadonlySet<string> = new Set([ENTRY, "使い方/guide.md"]);

// 文書と見出しを読む（正常系）
test("test_resolve_route", async () => {
  // 準備
  const { resolveRoute } = await loadRoute();
  const hash = "#/%E4%BD%BF%E3%81%84%E6%96%B9/guide.md#%E6%8F%8F%E3%81%8F";
  // 実行
  const route = resolveRoute(hash, PATHS, ENTRY);
  // 検証
  expect(route).toEqual({
    path: "使い方/guide.md",
    heading: "描く",
    missing: false,
  });
});

// # が無いと entry（正常系）
test("test_resolve_route_when_no_hash", async () => {
  // 準備
  const { resolveRoute } = await loadRoute();
  // 実行
  const route = resolveRoute("", PATHS, ENTRY);
  // 検証
  expect(route).toEqual({ path: ENTRY, heading: null, missing: false });
});

// #/ で始まらない # は文書の指定にしない（正常系）
test("test_resolve_route_when_heading_only", async () => {
  // 準備
  const { resolveRoute } = await loadRoute();
  // 実行
  const route = resolveRoute("#描く", PATHS, ENTRY);
  // 検証
  expect(route).toEqual({ path: ENTRY, heading: null, missing: false });
});

// 1 枚に無い文書は entry で missing（正常系）
test("test_resolve_route_when_missing_document", async () => {
  // 準備
  const { resolveRoute } = await loadRoute();
  // 実行
  const route = resolveRoute("#/下書き/メモ.md", PATHS, ENTRY);
  // 検証
  expect(route).toEqual({ path: ENTRY, heading: null, missing: true });
});
