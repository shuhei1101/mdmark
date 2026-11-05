import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  expectGuideRendered,
  guideMarkdown,
  replaceAllText,
  saveEditor,
  TRANSPILER_PATH,
  useVscodeE2E,
} from "../vscode.ts";

const e2e = useVscodeE2E();

/** 配布物の要求だけ（タグ一覧を除く） */
function distRequests(): string[] {
  return e2e
    .stub()
    .requests()
    .filter((path) => path !== "/tags");
}

/** 配布物を読めない・バージョンを決められないときの、文書の代わりの表示 */
function notice(frame: import("@playwright/test").Frame) {
  return frame.locator(".mdmark-preview-notice");
}

// Shift+Alt+D で、タグ一覧の最新のバージョンの配布物を読んで横の列に描く（正常シナリオ）
test("test_normal", async () => {
  // 準備
  const stub = e2e.stub();
  const session = await e2e.launch({
    files: { "guide.md": await guideMarkdown() },
  });
  await session.openFile("guide.md");
  // 実行
  await session.openPreviewWithShortcut();
  // 検証
  const frame = await session.previewFrame();
  await expectGuideRendered(frame);
  const editorTab = await session.win
    .locator('.tab[aria-label*="guide.md"]')
    .first()
    .boundingBox();
  const previewTab = await session.win
    .locator('.tab[aria-label*="プレビュー guide.md"]')
    .first()
    .boundingBox();
  expect(previewTab?.x).toBeGreaterThan(
    (editorTab?.x ?? 0) + (editorTab?.width ?? 0) - 1,
  );
  const requests = stub.requests();
  expect(requests).toContain("/mdmark@v0.7.0/dist/index.js");
  expect(requests).toContain("/mdmark@v0.7.0/dist/index.css");
  expect(requests.some((path) => path.includes("vscode-v0.1.0"))).toBe(false);
  // 前回のバージョンとして残ったことを、タグ一覧が応えない状態のリロードで確かめる
  stub.setMode({ tags: "hang", dist: "ok" });
  stub.clear();
  // フォーカスがプレビューにあるとコマンドパレットが開かないため、エディタへ戻す
  await session.focusEditor();
  await session.runCommand("mdmark: プレビューをリロード");
  await expect
    .poll(() => stub.requests())
    .toContain("/mdmark@v0.7.0/dist/index.js");
  await expectGuideRendered(await session.previewFrame());
});

// コマンドパレットの「プレビューを開く」で、Markdown と同じ列のタブに開く（正常シナリオ（同じ列に開く））
test("test_normal_when_same_column", async () => {
  // 準備
  const session = await e2e.launch({
    files: { "guide.md": await guideMarkdown() },
  });
  await session.openFile("guide.md");
  // 実行
  await session.runCommand("mdmark: プレビューを開く");
  // 検証
  await expectGuideRendered(await session.previewFrame());
  const group = session.win.locator(".editor-group-container");
  await expect(group).toHaveCount(1);
  await expect(
    group.locator('.tab[aria-label*="プレビュー guide.md"]'),
  ).toHaveCount(1);
  await expect(group.locator('.tab[aria-label="guide.md"]')).toHaveCount(1);
});

// 設定でバージョンを固定すると、タグ一覧を取らずにそのバージョンを読む（正常シナリオ（バージョンを固定する））
test("test_normal_when_version_pinned", async () => {
  // 準備
  const stub = e2e.stub();
  const session = await e2e.launch({
    files: { "guide.md": await guideMarkdown() },
    settings: { "mdmark.version": "v0.6.0" },
  });
  await session.openFile("guide.md");
  // 実行
  await session.openPreviewWithShortcut();
  // 検証
  await expectGuideRendered(await session.previewFrame());
  expect(stub.requests()).toContain("/mdmark@v0.6.0/dist/index.js");
  expect(stub.requests()).not.toContain("/tags");
});

// タグ一覧を取れないとき、前回のバージョンで描き、描けない理由は出ない（正常シナリオ（タグ一覧を取れない））
test("test_normal_when_tags_unreachable", async () => {
  // 準備: 前回のバージョン v0.6.0 を残してプレビューを閉じ、タグ一覧が応えない状態にする
  const stub = e2e.stub();
  stub.setTags(["v0.6.0"]);
  const session = await e2e.launch({
    files: { "guide.md": await guideMarkdown() },
  });
  await session.openFile("guide.md");
  await session.openPreviewWithShortcut();
  await expectGuideRendered(await session.previewFrame());
  // フォーカスの位置に依らず、プレビューのタブを押してから閉じる
  await session.win.locator('.tab[aria-label*="プレビュー guide.md"]').click();
  await session.win.keyboard.press("Control+W");
  await expect(
    session.win.locator('.tab[aria-label*="プレビュー guide.md"]'),
  ).toHaveCount(0);
  await expect(session.win.locator('.tab[aria-label="guide.md"]')).toHaveCount(
    1,
  );
  stub.setTags(["v0.7.0"]);
  stub.setMode({ tags: "hang", dist: "ok" });
  stub.clear();
  await session.focusEditor();
  // 実行
  await session.openPreviewWithShortcut();
  // 検証
  const frame = await session.previewFrame();
  await expectGuideRendered(frame);
  expect(stub.requests()).toContain("/mdmark@v0.6.0/dist/index.js");
  expect(stub.requests()).not.toContain("/mdmark@v0.7.0/dist/index.js");
  await expect(notice(frame)).toHaveCount(0);
});

// 配布物を読めないとき、オフラインの理由と「リロード」を出し、Markdown と設定ファイルは書き換えない（異常シナリオ（配布物を読めない））
test("test_error_when_distribution_unreachable", async () => {
  // 準備
  const markdown = await guideMarkdown();
  const config = "features:\n  callout: false\n";
  const session = await e2e.launch({
    files: { "guide.md": markdown, "mdmark.config.yaml": config },
  });
  e2e.stub().setMode({ tags: "ok", dist: "drop" });
  await session.openFile("guide.md");
  // 実行
  await session.openPreviewWithShortcut();
  // 検証
  const frame = await session.previewFrame();
  await expect(notice(frame)).toContainText("プレビューを表示できません");
  await expect(notice(frame)).toContainText(
    "jsDelivr から読み込めませんでした",
  );
  await expect(notice(frame)).toContainText("v0.7.0");
  await expect(frame.getByRole("button", { name: "リロード" })).toBeVisible();
  await expect(frame.locator("h1").filter({ hasText: "見出し" })).toHaveCount(
    0,
  );
  expect(await readFile(join(session.workspaceDir, "guide.md"), "utf8")).toBe(
    markdown,
  );
  expect(
    await readFile(join(session.workspaceDir, "mdmark.config.yaml"), "utf8"),
  ).toBe(config);
});

// 指定したバージョンが無いとき、そのバージョンが無い理由と「リロード」を出す（異常シナリオ（指定したバージョンが無い））
test("test_error_when_version_missing", async () => {
  // 準備
  const session = await e2e.launch({
    files: { "guide.md": await guideMarkdown() },
    settings: { "mdmark.version": "v9.9.9" },
  });
  await session.openFile("guide.md");
  // 実行
  await session.openPreviewWithShortcut();
  // 検証
  const frame = await session.previewFrame();
  await expect(notice(frame)).toContainText("v9.9.9");
  await expect(notice(frame)).toContainText("見つかりませんでした");
  await expect(frame.getByRole("button", { name: "リロード" })).toBeVisible();
});

// バージョンを決められないとき、その理由と「リロード」を出し、配布物を要求しない（異常シナリオ（バージョンを決められない））
test("test_error_when_version_undecidable", async () => {
  // 準備
  e2e.stub().setMode({ tags: "hang", dist: "ok" });
  const session = await e2e.launch({
    files: { "guide.md": await guideMarkdown() },
  });
  await session.openFile("guide.md");
  // 実行
  await session.openPreviewWithShortcut();
  // 検証
  const frame = await session.previewFrame();
  await expect(notice(frame)).toContainText("バージョンを決められませんでした");
  await expect(frame.getByRole("button", { name: "リロード" })).toBeVisible();
  expect(distRequests()).toEqual([]);
});

// マーカーの場所に取り込み先の見出しの中を描き、取り込み先の保存で描き直し、無い取り込み先には書き方の警告を出す（正常シナリオ（取り込む文書を描く））
test("test_normal_when_includes", async () => {
  // 準備
  const session = await e2e.launch({
    files: {
      "guide.md": [
        "# 案内",
        "",
        "<!-- include: 共通/手順.md#実行 -->",
        "",
        "<!-- include: 共通/無い.md -->",
        "",
      ].join("\n"),
      "共通/手順.md": [
        "# 手順",
        "",
        "## 実行",
        "",
        "取り込む前の文です。",
        "",
        "## 片付け",
        "",
        "取り込まない文です。",
        "",
      ].join("\n"),
    },
  });
  await session.openFile("guide.md");
  // 実行
  await session.openPreviewWithShortcut();
  // 検証
  const frame = await session.frameWith("h2");
  await expect(frame.locator("h2", { hasText: "実行" })).toBeVisible();
  await expect(frame.getByText("取り込む前の文です。")).toBeVisible();
  await expect(frame.getByText("取り込まない文です。")).toHaveCount(0);
  await expect(frame.locator(".mdmark-syntax-warning")).toHaveCount(1);
  await expect(frame.locator(".mdmark-syntax-warning")).toContainText(
    "共通/無い.md",
  );
  // 実行: 取り込み先を書き換えて保存する
  await session.openFile("共通/手順.md");
  await replaceAllText(session, "## 実行\n\n書き換えた後の文です。\n");
  await saveEditor(session);
  // 検証
  const rerendered = await session.frameWith("h2");
  await expect(rerendered.getByText("書き換えた後の文です。")).toBeVisible();
  await expect(rerendered.getByText("取り込む前の文です。")).toHaveCount(0);
});

/** 範囲に html・css・ts を置き、ts が箱を押すと根の要素に class `is-open` を付け外しする文書 */
const RANGE_SCRIPT_MARKDOWN = [
  "# 範囲のスクリプト",
  "",
  "<!-- html -->",
  "",
  "```html",
  '<div class="box">箱</div>',
  "```",
  "",
  "```css",
  ".box { background-color: rgb(255, 0, 0); }",
  "```",
  "",
  "```ts",
  "export default (root: HTMLElement): void => {",
  '  root.querySelector(".box")?.addEventListener("click", () => {',
  '    root.classList.toggle("is-open");',
  "  });",
  "};",
  "```",
  "",
  "<!-- /html -->",
  "",
].join("\n");

// 範囲の ts をページの nonce を付けた script 要素で動かし、CSP を広げずに範囲の css と ts を当てる（正常シナリオ（範囲のスクリプトと CSS））
test("test_normal_when_range_scripts", async () => {
  // 準備
  const stub = e2e.stub();
  const session = await e2e.launch({
    files: {
      "guide.md": RANGE_SCRIPT_MARKDOWN,
      "mdmark.config.yaml": [
        "features:",
        "  html-scripts: true",
        "html-scripts:",
        `  url: ${stub.origin}${TRANSPILER_PATH}`,
        "",
      ].join("\n"),
    },
  });
  await session.openFile("guide.md");
  // 実行
  await session.openPreviewWithShortcut();
  // 検証: 範囲の css と ts
  const frame = await session.frameWith('.mdmark-html[data-html-scope="0"]');
  const scope = frame.locator('.mdmark-html[data-html-scope="0"]');
  const box = scope.locator(".box");
  await expect(box).toHaveCSS("background-color", "rgb(255, 0, 0)");
  await expect.poll(() => stub.requests()).toContain(TRANSPILER_PATH);
  await expect(async () => {
    await box.click();
    await expect(scope).toHaveClass(/\bis-open\b/, { timeout: 500 });
  }).toPass();
  await expect(frame.locator(".mdmark-notice")).toHaveCount(0);
  await expect(frame.locator(".mdmark-syntax-warning")).toHaveCount(0);
  // 検証: CSP は正常シナリオと同じで、blob:・'unsafe-inline'・'unsafe-eval' を足さない
  const csp =
    (await frame
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute("content")) ?? "";
  const scriptSrc =
    csp
      .split("; ")
      .find((directive) => directive.startsWith("script-src "))
      ?.split(" ")
      .slice(1) ?? [];
  expect(scriptSrc[0]).toMatch(/^'nonce-[^']+'$/);
  expect(scriptSrc).toContain(stub.origin);
  expect(scriptSrc).toContain("https://cdn.jsdelivr.net");
  for (const word of ["blob:", "'unsafe-inline'", "'unsafe-eval'"]) {
    expect(scriptSrc).not.toContain(word);
  }
  expect(scriptSrc).toHaveLength(4);
});
