import { afterEach, expect, test, vi } from "vitest";
import { dependencies } from "../../../package.json";
import { createRootFromHtml, removeRoots } from "../helpers/dom.ts";

/** まとめていないアイコンの読み込みを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadInlineIcons = () => import("../../../src/inline-icons.ts");

/** 中が空の行内のアイコンを段落に入れた HTML */
function emptyIcons(names: string[]): string {
  return names
    .map(
      (name) =>
        `<p><span class="mdmark-inline-icon" data-icon="${name}" aria-hidden="true"></span> 本文</p>`,
    )
    .join("");
}

/** 構造を 1 つ持つ Lucide のアイコンのモジュール */
const ICON_MODULE = { default: [["path", { d: "M1 1" }]] };

afterEach(() => {
  vi.restoreAllMocks();
  removeRoots();
});

// 名前ごとに 1 回だけ読み込む（正常系）
test("test_load_inline_icons", async () => {
  // 準備
  const { loadInlineIcons: load } = await loadInlineIcons();
  const root = createRootFromHtml(
    emptyIcons(["sailboat", "sailboat", "anchor"]),
  );
  const importModule = vi.fn(async (_url: string) => ICON_MODULE);
  const fetchHead = vi.fn(async (_url: string) => new Response(null));
  // 実行
  await load({
    root,
    icons: {},
    isCurrent: () => true,
    importModule,
    fetchHead,
  });
  // 検証
  const urls = importModule.mock.calls.map(([url]) => url);
  expect(urls).toHaveLength(2);
  expect(urls.some((url) => url.endsWith("/sailboat.mjs"))).toBe(true);
  expect(urls.some((url) => url.endsWith("/anchor.mjs"))).toBe(true);
  expect(root.querySelectorAll(".mdmark-inline-icon svg")).toHaveLength(3);
  expect(fetchHead).not.toHaveBeenCalled();
});

// 404 は記載の警告にする（異常系）
test("test_load_inline_icons_when_not_found", async () => {
  // 準備
  const { loadInlineIcons: load } = await loadInlineIcons();
  const root = createRootFromHtml(emptyIcons(["no-such-icon"]));
  const importModule = vi.fn(async (_url: string) => {
    throw new TypeError("Failed to fetch dynamically imported module");
  });
  const fetchHead = vi.fn(
    async (_url: string) => new Response(null, { status: 404 }),
  );
  // 実行
  await load({
    root,
    icons: {},
    isCurrent: () => true,
    importModule,
    fetchHead,
  });
  // 検証
  expect(root.innerHTML).toContain("<code>icon:no-such-icon</code>");
  const warning = root.querySelector(".mdmark-syntax-warning");
  expect(warning).not.toBeNull();
  expect(warning?.nextElementSibling?.tagName).toBe("P");
  expect(root.querySelector(".mdmark-notice")).toBeNull();
});

// 読み込めないときは通知ブロックを 1 つ配置する（異常系）
test("test_load_inline_icons_when_offline", async () => {
  // 準備
  const { loadInlineIcons: load } = await loadInlineIcons();
  const root = createRootFromHtml(emptyIcons(["sailboat", "anchor"]));
  const importModule = vi.fn(async (_url: string) => {
    throw new TypeError("Failed to fetch dynamically imported module");
  });
  const fetchHead = vi.fn(async (_url: string) => {
    throw new TypeError("Failed to fetch");
  });
  // 実行
  await load({
    root,
    icons: {},
    isCurrent: () => true,
    importModule,
    fetchHead,
  });
  // 検証
  expect(root.querySelectorAll(".mdmark-inline-icon")).toHaveLength(0);
  expect(root.querySelectorAll("code")).toHaveLength(2);
  expect(root.querySelectorAll(".mdmark-notice")).toHaveLength(1);
  expect(root.firstElementChild?.classList.contains("mdmark-notice")).toBe(
    true,
  );
});

// 古い描画の結果を書き込まない（正常系）
test("test_load_inline_icons_when_stale", async () => {
  // 準備
  const { loadInlineIcons: load } = await loadInlineIcons();
  const root = createRootFromHtml(emptyIcons(["sailboat", "no-such-icon"]));
  let current = true;
  const importModule = vi.fn(async (_url: string) => {
    current = false;
    throw new TypeError("Failed to fetch dynamically imported module");
  });
  const fetchHead = vi.fn(async (url: string) =>
    url.includes("no-such-icon")
      ? new Response(null, { status: 404 })
      : Promise.reject(new TypeError("Failed to fetch")),
  );
  // 実行
  await load({
    root,
    icons: {},
    isCurrent: () => current,
    importModule,
    fetchHead,
  });
  // 検証
  expect(root.querySelector(".mdmark-notice")).toBeNull();
  expect(root.querySelector(".mdmark-syntax-warning")).toBeNull();
  expect(root.querySelectorAll(".mdmark-inline-icon")).toHaveLength(2);
});

// まとめたバージョンの URL にする（正常系）
test("test_lucide_icon_url", async () => {
  // 準備
  const { lucideIconUrl } = await loadInlineIcons();
  // 実行
  const url = lucideIconUrl("sailboat");
  // 検証
  expect(url).toBe(
    `https://cdn.jsdelivr.net/npm/lucide@${dependencies.lucide}/dist/esm/icons/sailboat.mjs`,
  );
});
