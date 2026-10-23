import { expect, test } from "@playwright/test";
import {
  expectGuideRendered,
  guideMarkdown,
  replaceAllText,
  replaceFirstLine,
  saveEditor,
  useVscodeE2E,
} from "../vscode.ts";

const e2e = useVscodeE2E();

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

// 背面に回したプレビューは、表に戻したときに最後の全文で描く（正常シナリオ（背面から戻る））
test("test_normal_when_revealed", async () => {
  // 準備: 同じ列にプレビューを開き、別のタブの後ろに回す
  const session = await e2e.launch({
    files: { "guide.md": await guideMarkdown(), "other.md": "# 別の文書\n" },
  });
  await session.openFile("guide.md");
  await session.runCommand("mdmark: プレビューを開く");
  await expectGuideRendered(await session.previewFrame());
  await session.win.getByRole("tab", { name: /^guide\.md/ }).click();
  // 実行: パネルが背面の間に見出しを 3 回書き換える
  for (const text of ["# 書き換え 1", "# 書き換え 2", "# 書き換え 3"]) {
    await replaceFirstLine(session, text);
    await session.win.waitForTimeout(500);
  }
  await session.win.getByRole("tab", { name: /プレビュー guide\.md/ }).click();
  // 検証
  const frame = await session.previewFrame();
  await expect(frame.locator("h1").first()).toContainText("書き換え 3");
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
