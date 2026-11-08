import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, type Frame, test } from "@playwright/test";
import {
  cascadeSettings,
  cascadeTheme,
  greetSource,
  themeValue,
} from "../cascade.ts";
import {
  expectGuideRendered,
  guideMarkdown,
  replaceAllText,
  replaceFirstLine,
  saveEditor,
  useVscodeE2E,
  type VscodeSession,
} from "../vscode.ts";
import { openCascadedPreview } from "../vscode-cascade.ts";

const e2e = useVscodeE2E();

/** 用語のエイリアスの行を持つ設定ファイル（`extra` の行を `aliases` の後ろに足す） */
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

/** 設定ファイルの内容: `features` を書いていない */
const EMPTY_CONFIG = "# mdmark の設定\n";

// 保存しないまま、最後に打ってから待った後に最後の全文だけを描き直す（正常シナリオ）
test("test_normal", async () => {
  // 準備
  const session = await e2e.launch({
    files: { "guide.md": await guideMarkdown() },
  });
  await session.openFile("guide.md");
  await session.openPreviewWithShortcut();
  const frame = await session.previewFrame();
  await expectGuideRendered(frame);
  // 見出しの文字が変わるたびに、そのときの文字を控える
  await frame.evaluate(() => {
    const target = window as unknown as { __h1: Array<string | undefined> };
    target.__h1 = [];
    new MutationObserver(() => {
      target.__h1.push(document.querySelector("h1")?.textContent ?? undefined);
    }).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
  // 実行: 100 ms おきに打つ（待ちの 300 ms より短い）
  await session.win.getByRole("tab", { name: /^guide\.md/ }).click();
  await replaceFirstLine(session, "# 書き換えた見出し", 100);
  // 検証
  await expect(frame.locator("h1")).toContainText("書き換えた見出し");
  const texts = await frame.evaluate(() =>
    (window as unknown as { __h1: Array<string | undefined> }).__h1.filter(
      Boolean,
    ),
  );
  for (const text of texts) {
    expect(text).toContain("書き換えた見出し");
  }
});

// 保存したときだけ描き直す設定では、保存の前は変わらず、保存すると書き換えた文字になる（正常シナリオ（保存したときだけ描き直す））
test("test_normal_when_live_update_off", async () => {
  // 準備
  const session = await e2e.launch({
    files: { "guide.md": await guideMarkdown() },
    settings: { "mdmark.preview.liveUpdate": false },
  });
  await session.openFile("guide.md");
  await session.openPreviewWithShortcut();
  const frame = await session.previewFrame();
  await expectGuideRendered(frame);
  await session.win.getByRole("tab", { name: /^guide\.md/ }).click();
  // 実行
  await replaceFirstLine(session, "# 保存した見出し");
  // 検証: 保存の前
  await session.win.waitForTimeout(1500);
  await expect(frame.locator("h1").first()).toHaveText(/^見出し/);
  // 実行: 保存する
  await saveEditor(session);
  // 検証
  await expect(frame.locator("h1").first()).toContainText("保存した見出し");
});

// 設定ファイルを保存すると、新しい設定で描き直す（正常シナリオ（設定ファイルを保存する））
test("test_normal_when_config_saved", async () => {
  // 準備
  const session = await e2e.launch({
    files: {
      "guide.md": await guideMarkdown(),
      "mdmark.config.yaml": EMPTY_CONFIG,
    },
  });
  await session.openFile("guide.md");
  await session.openPreviewWithShortcut();
  const frame = await session.previewFrame();
  await expectGuideRendered(frame);
  await expect(frame.locator(".markdown-alert")).toHaveCount(1);
  await session.openFile("mdmark.config.yaml");
  // 実行
  await replaceAllText(session, "features: { callout: false }");
  await saveEditor(session);
  // 検証
  await expect(frame.locator(".markdown-alert")).toHaveCount(0);
  await expect(frame.locator("blockquote")).toHaveCount(1);
});

// 見出しを多く持つ長い文書の節の数と、1 つの節の行数（見出し 1 行・空行 1 行・6 の段落 × 2 行）
const REVEAL_SECTIONS = 20;
const REVEAL_SECTION_LINES = 14;
const REVEAL_PARAGRAPHS = 6;
// 見出し A と見出し B の節（1 始まり）。B は A のすぐ次の節で、A を先頭にしたエディタの見えている範囲にある
const HEADING_A_SECTION = 5;
const HEADING_B_SECTION = 6;

// エディタの先頭の行が落ち着くのを待つ回数の上限
const SETTLE_ATTEMPTS = 50;

/** 見出しで区切った 20 の節を持つ長い Markdown */
function revealDocument(): string {
  return Array.from({ length: REVEAL_SECTIONS }, (_, section) =>
    [
      `## 見出し ${section + 1}`,
      "",
      ...Array.from({ length: REVEAL_PARAGRAPHS }, (_, paragraph) => [
        `${section + 1}-${paragraph + 1} 段落の本文です。`,
        "",
      ]).flat(),
    ].join("\n"),
  ).join("\n");
}

/** `n` 番目の節（1 始まり）の見出しの行（エディタの行番号。1 始まり） */
function revealHeadingLine(n: number): number {
  return (n - 1) * REVEAL_SECTION_LINES + 1;
}

/** プレビューの `n` 番目の節の見出し（元の行番号で選ぶ） */
function revealHeading(frame: Frame, n: number) {
  return frame.locator(`h2[data-source-line="${revealHeadingLine(n) - 1}"]`);
}

/** プレビューの見えている先頭（右側の目次が上端の帯のときは帯の下端、無いときは 0） */
function visibleTop(frame: Frame): Promise<number> {
  return frame.evaluate(() => {
    const aside = document.querySelector(".mdmark-side-toc");
    const content = document.querySelector(".mdmark-content");
    if (
      !aside ||
      !content ||
      aside.getBoundingClientRect().width <
        content.getBoundingClientRect().width
    ) {
      return 0;
    }
    return aside.getBoundingClientRect().bottom;
  });
}

/** プレビューの見えている先頭にある見出しの文字 */
async function firstVisibleHeading(frame: Frame): Promise<string | undefined> {
  const top = await visibleTop(frame);
  return frame.evaluate(
    (top) =>
      [...document.querySelectorAll("h2")]
        .find((heading) => heading.getBoundingClientRect().bottom > top)
        ?.textContent?.trim(),
    top,
  );
}

/** エディタの先頭の行が 300 ms 変わらなくなるまで待ち、その行を返す */
async function settledEditorTop(session: VscodeSession): Promise<number> {
  let last = await session.editorTopLine();
  for (let attempt = 0; attempt < SETTLE_ATTEMPTS; attempt += 1) {
    await session.win.waitForTimeout(300);
    const current = await session.editorTopLine();
    if (current === last) {
      return current;
    }
    last = current;
  }
  throw new Error("エディタのスクロールが止まらない");
}

/** 左の列のエディタで `line` 行目（1 始まり）を `text` に打ち替える（見えている範囲の行なので、エディタはスクロールしない） */
async function replaceLine(
  session: VscodeSession,
  line: number,
  text: string,
): Promise<void> {
  await session.win.keyboard.press("Control+1");
  await session.win.keyboard.press("Control+G");
  await session.win.keyboard.type(String(line));
  await session.win.keyboard.press("Enter");
  await session.win.keyboard.press("Home");
  await session.win.keyboard.press("Shift+End");
  await session.win.keyboard.type(text);
}

/** 右の列に `relative` のファイルを開く */
async function openFileInRightColumn(
  session: VscodeSession,
  relative: string,
): Promise<void> {
  await session.win.keyboard.press("Control+2");
  await session.win.keyboard.press("Control+P");
  const input = session.win.locator(".quick-input-box input");
  await input.waitFor();
  await input.fill(relative);
  await session.win
    .locator(`.quick-input-list .monaco-list-row[aria-label*="${relative}"]`)
    .first()
    .waitFor();
  await session.win.keyboard.press("Enter");
  await session.win
    .locator(`.tab[aria-label*="${relative}"]`)
    .first()
    .waitFor();
}

// 背面に回したプレビューは、表に戻したときに最後の全文で、背面に回す前のスクロールの位置に描く（正常シナリオ（背面から戻る））
test("test_normal_when_revealed", async () => {
  // 準備: 左の列に長い文書、右の列にプレビューを開き、見出し A が先頭に見えるまでプレビューをスクロールする
  const session = await e2e.launch({
    files: { "long.md": revealDocument(), "other.md": "# 別の文書\n" },
  });
  await session.openFile("long.md");
  await session.openPreviewWithShortcut();
  const before = await session.frameWith("h2");
  await expect(before.locator("h2")).toHaveCount(REVEAL_SECTIONS);
  // 開いた直後の位置合わせが落ち着くまで待つ
  await session.win.waitForTimeout(500);
  const top = await visibleTop(before);
  await revealHeading(before, HEADING_A_SECTION).evaluate((element, top) => {
    window.scrollBy(0, element.getBoundingClientRect().top - top);
  }, top);
  await expect
    .poll(async () =>
      Math.abs(
        (await session.editorTopLine()) - revealHeadingLine(HEADING_A_SECTION),
      ),
    )
    .toBeLessThanOrEqual(1);
  await settledEditorTop(session);
  // 右の列で別の文書を開き、プレビューのタブを背面に回す
  await openFileInRightColumn(session, "other.md");
  // 実行: パネルが背面の間に、エディタのスクロールを動かさずに見出し B を 3 回書き換える
  for (const text of ["## 書き換え 1", "## 書き換え 2", "## 書き換え 3"]) {
    await replaceLine(session, revealHeadingLine(HEADING_B_SECTION), text);
    await session.win.waitForTimeout(500);
  }
  const editorTop = await settledEditorTop(session);
  await session.win.locator('.tab[aria-label*="プレビュー long.md"]').click();
  // 検証
  const frame = await session.frameWith(
    `h2[data-source-line="${revealHeadingLine(HEADING_B_SECTION) - 1}"]`,
  );
  await expect(revealHeading(frame, HEADING_B_SECTION)).toHaveText(
    "書き換え 3",
  );
  await expect
    .poll(() => firstVisibleHeading(frame))
    .toBe(`見出し ${HEADING_A_SECTION}`);
  await session.win.waitForTimeout(500);
  expect(await session.editorTopLine()).toBe(editorTop);
});

// 描けないプレビューを「リロード」で描き直し、コマンドパレットの「プレビューをリロード」でも同じになる（正常シナリオ（リロードする））
test("test_normal_when_reloaded", async () => {
  // 準備
  const stub = e2e.stub();
  stub.setMode({ tags: "ok", dist: "drop" });
  const session = await e2e.launch({
    files: { "guide.md": await guideMarkdown() },
  });
  await session.openFile("guide.md");
  await session.openPreviewWithShortcut();
  const failed = await session.previewFrame();
  await expect(failed.getByRole("button", { name: "リロード" })).toBeVisible();
  stub.setMode({ tags: "ok", dist: "ok" });
  // 実行: 「リロード」を押す
  await failed.getByRole("button", { name: "リロード" }).click();
  // 検証
  let frame = await session.guideFrame();
  await expect(frame.getByRole("button", { name: "リロード" })).toHaveCount(0);
  // コマンドパレットからも同じ
  stub.setMode({ tags: "ok", dist: "drop" });
  await session.runCommand("mdmark: プレビューをリロード");
  await expect(
    (await session.frameWith(".mdmark-preview-notice")).getByRole("button", {
      name: "リロード",
    }),
  ).toBeVisible();
  stub.setMode({ tags: "ok", dist: "ok" });
  await session.runCommand("mdmark: プレビューをリロード");
  frame = await session.guideFrame();
  await expect(frame.getByRole("button", { name: "リロード" })).toHaveCount(0);
});

// 設定ファイルを読めないとき、文書は描いたまま、上部の帯と「設定ファイルを開く」で直しに行ける（異常シナリオ（設定ファイルを読めない））
test("test_error_when_config_unreadable", async () => {
  // 準備
  const session = await e2e.launch({
    files: {
      "guide.md": await guideMarkdown(),
      "mdmark.config.yaml": EMPTY_CONFIG,
    },
  });
  await session.openFile("guide.md");
  await session.openPreviewWithShortcut();
  const frame = await session.previewFrame();
  await expectGuideRendered(frame);
  await session.openFile("mdmark.config.yaml");
  // 実行: 読めない設定ファイルを保存し、設定ファイルのタブを閉じる
  await replaceAllText(session, "features: [");
  await saveEditor(session);
  // 検証
  const band = frame.locator(".mdmark-config-band");
  await expect(band).toContainText("設定ファイルを読み込めません");
  await expect(frame.locator("h1").first()).toHaveText(/^見出し/);
  await expect(frame.locator(".markdown-alert")).toHaveCount(1);
  // 実行: 設定ファイルのタブを閉じてから「設定ファイルを開く」を押す
  await session.win.getByRole("tab", { name: /^mdmark\.config\.yaml/ }).click();
  await session.win.keyboard.press("Control+W");
  await expect(
    session.win.getByRole("tab", { name: /^mdmark\.config\.yaml/ }),
  ).toHaveCount(0);
  await band.getByRole("button", { name: "設定ファイルを開く" }).click();
  // 検証
  await expect(
    session.win.getByRole("tab", { name: /^mdmark\.config\.yaml/ }),
  ).toHaveCount(1);
});

/** 描いた文書の見えている先頭のスクロールの位置 */
async function scrollTop(frame: Frame): Promise<number> {
  return frame.evaluate(() => document.scrollingElement?.scrollTop ?? 0);
}

// theme の CSS を書き換えて保存すると、リロードせずにプレビューに当たる（正常シナリオ（theme の CSS を書き換える））
test("test_normal_when_theme_css_saved", async () => {
  // 準備
  const opened = await openCascadedPreview(
    e2e,
    cascadeSettings({ cascade: true }),
  );
  await expect.poll(() => themeValue(opened.frame)).toBe("rgb(1, 2, 3)");
  const top = await scrollTop(opened.frame);
  const text = await opened.frame.locator(".mdmark").first().innerText();
  // 実行
  await writeFile(
    join(opened.session.workspaceDir, "theme.css"),
    cascadeTheme("rgb(4, 5, 6)"),
  );
  // 検証
  await expect.poll(() => themeValue(opened.frame)).toBe("rgb(4, 5, 6)");
  expect(await opened.frame.locator(".mdmark").first().innerText()).toBe(text);
  expect(await scrollTop(opened.frame)).toBe(top);
});

// ワークスペースの外の端末の設定と extensions のモジュールを保存すると、リロードせずにプレビューを描き直す（正常シナリオ（ワークスペースの外の設定を保存する））
test("test_normal_when_outside_config_saved", async () => {
  // 準備
  const opened = await openCascadedPreview(e2e, "config:\n  cascade: true\n");
  await expect(opened.frame.locator(".mdmark .markdown-alert")).toHaveCount(1);
  // 実行: 端末の設定に features.callout: false を足して保存する
  await writeFile(opened.settings, cascadeSettings({ cascade: true }));
  // 検証
  const frame = await opened.session.frameWith(".mdmark blockquote");
  await expect(frame.locator(".mdmark .markdown-alert")).toHaveCount(0);
  // 実行: extensions のモジュールを書き換えて保存する
  await writeFile(
    join(opened.session.workspaceDir, "ext", "greet.js"),
    greetSource("hello"),
  );
  // 検証: 拡張を束ね直して HTML を入れ直すため、フレームを探し直す
  await expect
    .poll(async () =>
      (await opened.session.frameWith(".mdmark [data-mdmark-slot]"))
        .locator(".mdmark [data-mdmark-slot]")
        .first()
        .innerText(),
    )
    .toBe("hello:世界");
});

// aliases の行が指す YAML を保存すると、リロードせずに書き換えた意味のツールチップで描き直す（正常シナリオ（aliases の YAML を書き換える））
test("test_normal_when_aliases_yaml_saved", async () => {
  // 準備
  const session = await e2e.launch({
    files: {
      "mdmark.config.yaml": aliasConfig(),
      "glossary.yaml": glossary("前の意味"),
      "guide.md": "# 案内\n\nレンダリングの段落\n",
    },
  });
  await session.openFile("guide.md");
  await session.openPreviewWithShortcut();
  const frame = await session.frameWith(".mdmark-term");
  const term = frame.locator(".mdmark-term", { hasText: "レンダリング" });
  await expect(term).toHaveCount(1);
  const top = await scrollTop(frame);
  const text = await frame.locator(".mdmark").first().innerText();
  // 実行
  await writeFile(
    join(session.workspaceDir, "glossary.yaml"),
    glossary("書き換えた意味"),
  );
  // 検証
  await expect
    .poll(async () => {
      await term.hover();
      return frame.locator('[role="tooltip"]:visible').innerText();
    })
    .toContain("書き換えた意味");
  // ツールチップは本文の中の要素なので、閉じてから本文の文字を比べる
  await session.win.mouse.move(0, 0);
  await expect
    .poll(() => frame.locator(".mdmark").first().innerText())
    .toBe(text);
  expect(await scrollTop(frame)).toBe(top);
});
