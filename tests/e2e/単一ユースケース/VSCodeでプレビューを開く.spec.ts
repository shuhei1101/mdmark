import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import {
  cascadeSettings,
  expectFeaturesOff,
  expectUpperApplied,
  expectUpperNotApplied,
} from "../cascade.ts";
import {
  MERMAID_ENTRY,
  MERMAID_FLOWCHART,
  MERMAID_STUB_PATH,
  MERMAID_SVG,
  MERMAID_WAIT_MS,
  mermaidColors,
} from "../mermaid.ts";
import {
  expectGuideRendered,
  guideMarkdown,
  replaceAllText,
  saveEditor,
  TRANSPILER_PATH,
  useVscodeE2E,
} from "../vscode.ts";
import { openCascadedPreview } from "../vscode-cascade.ts";

const e2e = useVscodeE2E();

/** 配布物の要求だけ（タグ一覧を除く） */
function distRequests(): string[] {
  return e2e
    .stub()
    .requests()
    .filter((path) => path !== "/tags");
}

/** 用語のエイリアスの行を持つ設定ファイル（`extra` の行を `aliases` の後ろに追加する） */
const aliasConfig = (extra: string[] = []) =>
  [
    "aliases:",
    "  - id: terms",
    "    paths: [glossary.yaml]",
    "    alias_type: term",
    "    records: terms",
    ...extra,
    "",
  ].join("\n");

/** 名前 `描画`・別名 `レンダリング` の用語 1 件を持つ YAML */
const glossary = (meaning: string) =>
  [
    "terms:",
    "  - id: render",
    "    name: 描画",
    "    aliases: [レンダリング]",
    `    description: ${meaning}`,
    "",
  ].join("\n");

/** 本文に別名 `レンダリング` を含む Markdown */
const ALIAS_MARKDOWN = "# 案内\n\nレンダリングの段落\n";

/** 配布物を読み込めない・バージョンを決められないときの、文書の代わりの表示 */
function notice(frame: import("@playwright/test").Frame) {
  return frame.locator(".mdmark-preview-notice");
}

// Shift+Alt+D で、タグ一覧の最新のバージョンの配布物を読み込んで横の列に描く（正常シナリオ）
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
  // 前回のバージョンとして残ったことを、タグ一覧が応えない状態のリロードで確認する
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

// 設定でバージョンを固定すると、タグ一覧を取らずにそのバージョンを読み込む（正常シナリオ（バージョンを固定する））
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

// 配布物を読み込めないとき、オフラインの理由と「リロード」を出し、Markdown と設定ファイルは書き換えない（異常シナリオ（配布物を読み込めない））
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

// マーカーの場所に取り込み先の見出しの中を描き、取り込み先の保存で再描画し、無い取り込み先には記載の警告を出す（正常シナリオ（取り込む文書を描く））
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

/** 範囲に html・css・ts を配置し、ts がノードを押すと根の要素に class `is-open` を付与・解除する文書 */
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

// 範囲の ts をページの nonce を付けた script 要素で動かし、CSP を広げずに範囲の css と ts を適用する（正常シナリオ（範囲のスクリプトと CSS））
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
  // 検証: CSP は正常シナリオと同じで、blob:・'unsafe-inline'・'unsafe-eval' を追加しない
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

// 端末の設定・上のフォルダ・近いフォルダの設定を重ね、上のフォルダの theme と extensions をプレビューに適用する（正常シナリオ（設定を重ねる））
test("test_normal_when_cascaded", async () => {
  // 準備・実行
  const opened = await openCascadedPreview(
    e2e,
    cascadeSettings({ cascade: true }),
  );
  // 検証
  await expectFeaturesOff(opened.frame);
  await expectUpperApplied(opened.frame);
  await expect(opened.frame.locator(".mdmark-notice")).toHaveCount(0);
  await expect(opened.frame.locator(".mdmark-config-band")).toHaveCount(0);
});

// config.cascade が false のとき、近いフォルダの設定と端末の設定だけでプレビューを描く（正常シナリオ（最初の 1 つだけを読み込む））
test("test_normal_when_first_only", async () => {
  // 準備・実行
  const opened = await openCascadedPreview(
    e2e,
    cascadeSettings({ cascade: false }),
  );
  // 検証
  await expectFeaturesOff(opened.frame);
  await expectUpperNotApplied(opened.frame);
});

// 端末の設定を YAML として読み込めないとき、文書を描いたまま帯に出し、帯から端末の設定を開く（異常シナリオ（設定ファイルを読み込めない））
test("test_error_when_config_unreadable", async () => {
  // 準備・実行
  const opened = await openCascadedPreview(
    e2e,
    cascadeSettings({ cascade: true, broken: true }),
  );
  // 検証
  const band = opened.frame.locator(".mdmark-config-band");
  await expect(band).toHaveCount(1);
  await expect(band).toContainText("settings.yaml");
  await expect(band).toContainText("3 行目");
  await expect(opened.frame.locator(".mdmark h1")).toContainText("ガイド");
  await band.locator('[data-action="openConfig"]').click();
  await expect(
    opened.session.win.locator('.tab.active[aria-label*="settings.yaml"]'),
  ).toHaveCount(1);
  expect(await opened.configs()).toEqual(opened.before);
});

// 設定の aliases から作ったエイリアスに、下線と種類ごとのツールチップが出る（正常シナリオ（設定の aliases のエイリアス））
test("test_normal_when_aliases", async () => {
  // 準備
  const session = await e2e.launch({
    files: {
      "mdmark.config.yaml": aliasConfig(),
      "glossary.yaml": glossary("Markdown を HTML にすること"),
      "guide.md": ALIAS_MARKDOWN,
      "plain/mdmark.config.yaml": "# エイリアスを持たない設定\n",
      "plain/plain.md": "# 素の文書\n\nレンダリングの段落\n",
    },
  });
  await session.openFile("guide.md");
  // 実行
  await session.openPreviewWithShortcut();
  const frame = await session.frameWith(".mdmark-term");
  const term = frame.locator(".mdmark-term", { hasText: "レンダリング" });
  await term.hover();
  // 検証
  await expect(term).toHaveCount(1);
  const tip = frame.locator('[role="tooltip"]:visible');
  await expect(tip).toHaveCount(1);
  await expect(tip).toContainText("用語");
  await expect(tip).toContainText("描画");
  await expect(tip).toContainText("Markdown を HTML にすること");
  // 実行: aliases を持たない設定の文書を開く
  await session.openFile("plain/plain.md");
  await session.openPreviewWithShortcut();
  // 検証
  const plain = await session.frameWith('.mdmark h1:has-text("素の文書")');
  await expect(plain.getByText("レンダリングの段落")).toBeVisible();
  await expect(plain.locator(".mdmark-term")).toHaveCount(0);
});

// aliases の行の YAML が無いとき、その行を除いて描き、出力チャネルに警告を記録する（異常シナリオ（aliases の YAML が無い））
test("test_error_when_aliases_missing", async () => {
  // 準備
  const session = await e2e.launch({
    files: {
      "mdmark.config.yaml": aliasConfig([
        "  - id: missing",
        "    paths: [missing/*.yaml]",
        "    alias_type: term",
      ]),
      "glossary.yaml": glossary("Markdown を HTML にすること"),
      "guide.md": ALIAS_MARKDOWN,
    },
  });
  await session.openFile("guide.md");
  // 実行
  await session.openPreviewWithShortcut();
  // 検証
  const frame = await session.frameWith(".mdmark-term");
  await expect(
    frame.locator(".mdmark-term", { hasText: "レンダリング" }),
  ).toHaveCount(1);
  await expect
    .poll(async () =>
      (await session.extensionLog()).some((line) =>
        line.includes("mdmark.config.yaml:aliases[1].paths: alias_no_files:"),
      ),
    )
    .toBe(true);
  await expect(frame.locator(".mdmark-config-band")).toHaveCount(0);
});

// mermaid のコードブロックを図の枠に入れて描き、VS Code の配色をダークに切り替えると暗い配色で再描画する（正常シナリオ（mermaid のコードブロック））
test("test_normal_when_mermaid", async () => {
  // 準備
  const stub = e2e.stub();
  const session = await e2e.launch({
    files: {
      "flow.md": MERMAID_FLOWCHART,
      "mdmark.config.yaml": `mermaid:\n  url: ${stub.origin}${MERMAID_STUB_PATH}${MERMAID_ENTRY}\n`,
    },
    userSettings: { "workbench.colorTheme": "Default Light Modern" },
  });
  await session.openFile("flow.md");
  // 実行
  await session.openPreviewWithShortcut();
  // 検証: 図の枠に入った mermaid の図
  const frame = await session.frameWith(MERMAID_SVG);
  await expect(frame.locator(MERMAID_SVG)).toHaveCount(1, {
    timeout: MERMAID_WAIT_MS,
  });
  await expect(frame.locator(".mdmark-notice")).toHaveCount(0);
  expect(stub.requests()).toContain(`${MERMAID_STUB_PATH}${MERMAID_ENTRY}`);
  // 検証: CSP の script-src に mermaid の読み込み先の origin が入り、違反が 0 件
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
  expect(scriptSrc).toContain(stub.origin);
  for (const word of ["blob:", "'unsafe-inline'", "'unsafe-eval'"]) {
    expect(scriptSrc).not.toContain(word);
  }
  await expect(frame.locator("html")).toHaveAttribute(
    "data-mdmark-csp-violations",
    "0",
  );
  const light = await mermaidColors(frame, { scope: "#mdmark-preview" });
  expect(light.fill).toBe(light.surface);
  // 実行: コマンドパレットでダークのテーマを選ぶ
  await session.runCommand("Preferences: Color Theme");
  await session.win.keyboard.type("Dark Modern");
  await session.win.waitForTimeout(500);
  await session.win.keyboard.press("Enter");
  // 検証: 暗い配色の CSS 変数で再描画する
  await expect
    .poll(
      async () => {
        const dark = await mermaidColors(frame, { scope: "#mdmark-preview" });
        return dark.fill === dark.surface && dark.surface !== light.surface;
      },
      { timeout: MERMAID_WAIT_MS },
    )
    .toBe(true);
  await expect(frame.locator("html")).toHaveAttribute(
    "data-mdmark-csp-violations",
    "0",
  );
});
