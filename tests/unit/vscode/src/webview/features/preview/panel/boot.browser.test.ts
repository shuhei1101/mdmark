import { afterEach, expect, test } from "vitest";

/** 始め方の読み取りを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBoot = () =>
  import(
    "../../../../../../../../vscode/src/webview/features/preview/panel/boot.ts"
  );

const placed: HTMLElement[] = [];

afterEach(() => {
  for (const element of placed.splice(0)) {
    element.remove();
  }
});

/** `data-*` を持つ要素を置く */
const element = (dataset: Record<string, string>): HTMLElement => {
  const root = document.createElement("div");
  Object.assign(root.dataset, dataset);
  document.body.append(root);
  placed.push(root);
  return root;
};

// data-* を読み、知らない status は持たない（正常系）
test("test_read_boot", async () => {
  // 準備
  const { readBoot } = await loadBoot();
  const full = element({
    distJs:
      "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@v0.7.0/dist/index.js",
    version: "v0.7.0",
    configPath: "docs/mdmark.config.yaml",
    test: "",
  });
  const other = element({ status: "other" });
  // 実行
  const first = readBoot(full);
  const second = readBoot(other);
  // 検証
  expect(first).toEqual({
    root: full,
    distJs:
      "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@v0.7.0/dist/index.js",
    version: "v0.7.0",
    status: undefined,
    configPath: "docs/mdmark.config.yaml",
    test: true,
  });
  expect(second.status).toBeUndefined();
  expect(second.configPath).toBe("");
  expect(second.test).toBe(false);
});

// line が数のときだけ返す（正常系）
test("test_saved_line_from", async () => {
  // 準備
  const { savedLineFrom } = await loadBoot();
  // 実行・検証
  expect(savedLineFrom({ line: 20.5 })).toBe(20.5);
  expect(savedLineFrom({ line: "20" })).toBeUndefined();
  expect(savedLineFrom(undefined)).toBeUndefined();
  expect(savedLineFrom(null)).toBeUndefined();
});
