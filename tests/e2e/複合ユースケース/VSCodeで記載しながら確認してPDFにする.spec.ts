import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import {
  guideMarkdown,
  type LibraryServer,
  longDocument,
  printCalls,
  recordPrint,
  replaceFirstLine,
  scrollEditorTo,
  startLibraryServer,
  useVscodeE2E,
} from "../vscode.ts";

const e2e = useVscodeE2E();

let library: LibraryServer | undefined;

test.afterEach(async () => {
  await library?.close();
  library = undefined;
});

/** 見出し・表・注意書き・流れ図と外部ライブラリの印を持ち、画面の高さを超える長さの Markdown */
async function sampleMarkdown(): Promise<string> {
  return [
    await guideMarkdown(),
    "<!-- my-lib -->",
    "",
    longDocument(),
    "",
  ].join("\n");
}

/** 見本のワークスペースのファイル: Markdown と、`features`・`libraries` を書いた設定ファイル */
async function files(): Promise<Record<string, string>> {
  library = await startLibraryServer({ delayMs: 300 });
  return {
    "guide.md": await sampleMarkdown(),
    "mdmark.config.yaml": `features:\n  callout: true\nlibraries:\n  my-lib: ${library.url}\n`,
  };
}

// プレビューで確かめながら書き、書き出した HTML を開いて印刷のダイアログを出す（正常シナリオ）
test("test_normal", async ({ browser }) => {
  // 準備
  const session = await e2e.launch({ files: await files() });
  await session.openFile("guide.md");
  // プレビューが Markdown の横の列に開き、mdmark で描かれる
  await session.openPreviewWithShortcut();
  const frame = await session.guideFrame();
  await expect(frame.locator("h2")).toHaveCount(10);
  await expect(frame.locator(".mdmark-embed[data-mdmark-drawn]")).toHaveCount(
    1,
  );
  // 見出しを書き換えると、保存せずにプレビューの見出しが書き換えた文字になる
  await replaceFirstLine(session, "# 書き換えた見出し");
  await expect(frame.locator("h1").first()).toContainText("書き換えた見出し");
  // エディタを文書の終わりの節まで動かすと、プレビューにその節の見出しが出る
  const lines = (await sampleMarkdown()).split("\n");
  await scrollEditorTo(session, lines.indexOf("## 節 10") + 1);
  const last = frame.locator("h2", { hasText: "節 10" });
  await expect
    .poll(async () => {
      const top = await last.evaluate(
        (element) => element.getBoundingClientRect().top,
      );
      const viewport = await frame.evaluate(() => window.innerHeight);
      return top >= -70 && top < viewport;
    })
    .toBe(true);
  // 書き出し先に HTML が 1 つ書かれ、ブラウザで開く代役にその HTML の URL が渡る
  const path = join(session.workspaceDir, "guide.html");
  const url = pathToFileURL(path).href;
  await session.runCommand("mdmark: HTML に書き出す");
  await expect
    .poll(() => session.notifications())
    .toContain(`HTML を書き出しました: ${path}`);
  await session.win.getByRole("button", { name: "ブラウザで開く" }).click();
  await expect.poll(() => session.openedUrls()).toEqual([url]);
  // 書き出した HTML を開くと、プレビューと同じ見出し・表・注意書き・流れ図が描かれる
  const exported = await browser.newPage();
  await exported.goto(url);
  await expect(exported.locator("h1").first()).toContainText(
    "書き換えた見出し",
  );
  await expect(exported.locator(".mdmark-table")).toHaveCount(1);
  await expect(exported.locator(".markdown-alert")).toHaveCount(1);
  await expect(exported.locator(".mdmark-diagram-frame")).toHaveCount(1);
  await exported.close();
  // PDF に印刷すると、書き出し直した HTML がブラウザで開き、印刷のダイアログが呼ばれる
  await session.runCommand("mdmark: PDF に印刷");
  await expect.poll(() => session.openedUrls()).toEqual([url, url]);
  const printed = await browser.newPage();
  await recordPrint(printed);
  await printed.goto(url);
  await expect.poll(async () => (await printCalls(printed)).length).toBe(1);
  expect((await printCalls(printed))[0]?.drawn).toBe(1);
  await printed.close();
});

// 配布物を読めないとき、プレビューに描けない理由を出し、Markdown と設定ファイルを書き換えず、読める状態に戻して描き直すと描かれる（異常シナリオ（配布物を読めない））
test("test_error_when_distribution_unreachable", async () => {
  // 準備
  const original = await files();
  const session = await e2e.launch({ files: original });
  e2e.stub().setMode({ tags: "ok", dist: "drop" });
  await session.openFile("guide.md");
  // 実行
  await session.openPreviewWithShortcut();
  // 検証: 描けない理由と、描き直す操作が出る
  const failed = await session.frameWith(".mdmark-preview-notice");
  await expect(failed.locator(".mdmark-preview-notice")).toContainText(
    "プレビューを表示できません",
  );
  await expect(failed.getByRole("button", { name: "リロード" })).toBeVisible();
  // Markdown と設定ファイルは書き換わらない
  for (const [name, content] of Object.entries(original)) {
    expect(await readFile(join(session.workspaceDir, name), "utf8")).toBe(
      content,
    );
  }
  // 配布物を配る状態へ戻して描き直すと描かれる
  e2e.stub().setMode({ tags: "ok", dist: "ok" });
  await failed.getByRole("button", { name: "リロード" }).click();
  const frame = await session.guideFrame();
  await expect(frame.locator("h1").first()).toContainText("見出し");
  await expect(frame.getByRole("button", { name: "リロード" })).toHaveCount(0);
});
