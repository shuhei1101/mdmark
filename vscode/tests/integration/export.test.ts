import * as assert from "node:assert";
import { existsSync } from "node:fs";
import { chmod, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import playwright from "playwright";
import * as vscode from "vscode";
import {
  guideMarkdown,
  installMessages,
  installOpenExternal,
  installRecorder,
  type LibraryServer,
  messages,
  opened,
  openMarkdown,
  readFixture,
  resetEnvironment,
  setSetting,
  sleep,
  startLibraryServer,
  trackFile,
  waitFor,
  workspaceDir,
  writeFixture,
} from "./helpers.ts";

/** 1 ピクセルの PNG */
const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** 書き出した HTML を開くときのページ */
type OpenedPage = {
  page: playwright.Page;
  close: () => Promise<void>;
};

let browser: playwright.Browser | undefined;

/** Playwright の Chromium で書き出した HTML を `file:` で開く */
async function openExported(
  path: string,
  setup?: (page: playwright.Page) => Promise<void>,
): Promise<OpenedPage> {
  browser ??= await playwright.chromium.launch();
  const page = await browser.newPage();
  await setup?.(page);
  await page.goto(pathToFileURL(path).href);
  return { page, close: () => page.close() };
}

/** 見出し・表・注意書き・図と画像、本文の `</script>` を持つ見本の文書を `docs/guide.md` に書いて開く */
async function openGuide(options: { extra?: string } = {}): Promise<void> {
  await writeFixture("docs/images/figure.png", PIXEL_PNG);
  await writeFixture(
    "docs/guide.md",
    [
      await guideMarkdown(),
      "![図](./images/figure.png)",
      "",
      "```html",
      "<script>alert(1)</script>",
      "```",
      "",
      options.extra ?? "",
    ].join("\n"),
  );
  await openMarkdown("docs/guide.md");
}

/** 書き出した HTML の `file:` の URL */
function exportedUrl(relative: string): string {
  return pathToFileURL(join(workspaceDir(), relative)).href;
}

/** 書き出せない通知の文: 書き出す先のパスと、OS が返した理由を含む */
function assertExportFailedNotice(message: string | undefined): void {
  const path = join(workspaceDir(), "locked", "out", "guide.html");
  assert.ok(message, "書き出せない通知が出ていない");
  assert.ok(message.startsWith(`HTML を書き出せませんでした: ${path}（`));
  assert.ok(message.includes("EACCES"));
  assert.ok(
    message.endsWith(
      "）。設定 mdmark.export.outputDir を書き込めるフォルダに直してください。",
    ),
  );
}

/** 書き込みを許さないフォルダを作る */
async function createReadOnlyDir(relative: string): Promise<void> {
  const path = join(workspaceDir(), relative);
  await mkdir(path, { recursive: true });
  await chmod(path, 0o555);
  trackFile(relative);
}

suite("HTML に書き出す", () => {
  suiteSetup(() => {
    installRecorder();
    installMessages();
    installOpenExternal();
  });
  suiteTeardown(async () => {
    await browser?.close();
    browser = undefined;
  });
  teardown(async () => {
    await chmod(join(workspaceDir(), "locked"), 0o755).catch(() => undefined);
    await resetEnvironment();
  });

  // Markdown と同じフォルダに書き出し、通知の「ブラウザで開く」から開く
  test("test_normal", async () => {
    // 準備
    await openGuide();
    messages.answer = "ブラウザで開く";
    trackFile("docs/guide.html");
    // 実行
    await vscode.commands.executeCommand("mdmark.exportHtml");
    // 検証
    await waitFor(() => opened.length === 1, {
      message: "ブラウザで開くが呼ばれない",
    });
    assert.deepStrictEqual(opened, [exportedUrl("docs/guide.html")]);
    assert.strictEqual(messages.info.length, 1);
    assert.strictEqual(
      messages.info[0],
      `HTML を書き出しました: ${join(workspaceDir(), "docs", "guide.html")}`,
    );
    assert.deepStrictEqual(messages.infoItems[0], ["ブラウザで開く"]);
    const files = await readdir(join(workspaceDir(), "docs"));
    assert.deepStrictEqual(
      files.filter((name) => name.endsWith(".html")),
      ["guide.html"],
    );
    assert.ok(!files.some((name) => name.endsWith(".tmp")));
    const exported = await openExported(
      join(workspaceDir(), "docs", "guide.html"),
    );
    try {
      await exported.page.waitForSelector(".mdmark-diagram-frame");
      assert.ok((await exported.page.locator("h1").count()) > 0);
      assert.ok((await exported.page.locator("table").count()) > 0);
      assert.ok((await exported.page.locator(".markdown-alert").count()) > 0);
      await exported.page.waitForFunction(
        () =>
          (document.querySelector("img") as HTMLImageElement | null)
            ?.naturalWidth,
      );
      assert.ok(
        (await exported.page.locator("pre").allInnerTexts()).some((text) =>
          text.includes("<script>alert(1)</script>"),
        ),
      );
    } finally {
      await exported.close();
    }
  });

  // outputDir のフォルダに書き、保存していない書き換えも入れる
  test("test_normal_when_output_dir", async () => {
    // 準備
    await openGuide();
    await setSetting("export.outputDir", "out");
    trackFile("out");
    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    await editor.edit((builder) =>
      builder.replace(editor.document.lineAt(0).range, "# 保存前の見出し"),
    );
    // 実行
    await vscode.commands.executeCommand("mdmark.exportHtml");
    // 検証
    const path = join(workspaceDir(), "out", "guide.html");
    await waitFor(() => existsSync(path), { message: "書き出されない" });
    assert.ok(!existsSync(join(workspaceDir(), "docs", "guide.html")));
    const exported = await openExported(path);
    try {
      await exported.page.waitForSelector("h1");
      assert.strictEqual(
        await exported.page.locator("h1").first().innerText(),
        "保存前の見出し",
      );
      // 画像は Markdown のフォルダ（docs）から解決される
      await exported.page.waitForFunction(
        () =>
          (document.querySelector("img") as HTMLImageElement | null)
            ?.naturalWidth,
      );
    } finally {
      await exported.close();
    }
  });

  // 書き出す先に書けないとき、理由を通知して何も残さない
  test("test_error_when_output_unwritable", async () => {
    // 準備
    await openGuide();
    await createReadOnlyDir("locked");
    await setSetting("export.outputDir", "locked/out");
    // 実行
    await vscode.commands.executeCommand("mdmark.exportHtml");
    // 検証
    assert.strictEqual(messages.error.length, 1);
    assertExportFailedNotice(messages.error[0]);
    assert.deepStrictEqual(opened, []);
    assert.deepStrictEqual(await readdir(join(workspaceDir(), "locked")), []);
  });
});

suite("ブラウザで開く", () => {
  suiteSetup(() => {
    installRecorder();
    installMessages();
    installOpenExternal();
  });
  suiteTeardown(async () => {
    await browser?.close();
    browser = undefined;
  });
  teardown(async () => {
    await chmod(join(workspaceDir(), "locked"), 0o755).catch(() => undefined);
    await resetEnvironment();
  });

  // 書き出した HTML が無くても、書き出してから開く
  test("test_normal", async () => {
    // 準備
    await openGuide();
    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    await editor.edit((builder) =>
      builder.replace(editor.document.lineAt(0).range, "# 保存前の見出し"),
    );
    trackFile("docs/guide.html");
    assert.ok(!existsSync(join(workspaceDir(), "docs", "guide.html")));
    // 実行
    await vscode.commands.executeCommand("mdmark.openInBrowser");
    // 検証
    assert.deepStrictEqual(opened, [exportedUrl("docs/guide.html")]);
    assert.deepStrictEqual(messages.info, []);
    const exported = await openExported(
      join(workspaceDir(), "docs", "guide.html"),
    );
    try {
      await exported.page.waitForSelector("h1");
      assert.strictEqual(
        await exported.page.locator("h1").first().innerText(),
        "保存前の見出し",
      );
    } finally {
      await exported.close();
    }
  });

  // 書き出せないときはブラウザを開かない
  test("test_error_when_output_unwritable", async () => {
    // 準備
    await openGuide();
    await createReadOnlyDir("locked");
    await setSetting("export.outputDir", "locked/out");
    // 実行
    await vscode.commands.executeCommand("mdmark.openInBrowser");
    // 検証
    assert.strictEqual(messages.error.length, 1);
    assertExportFailedNotice(messages.error[0]);
    assert.deepStrictEqual(opened, []);
  });

  // 設定ファイルの colorTheme を mdmark.colorTheme で上書きしたテーマで、書き出した HTML を描く
  test("test_normal_when_color_theme_selected", async () => {
    // 準備
    await writeFixture("mdmark.config.yaml", "colorTheme: theme-paper\n");
    await openGuide();
    await setSetting("colorTheme", "theme-slate");
    trackFile("docs/guide.html");
    // 実行
    await vscode.commands.executeCommand("mdmark.exportHtml");
    // 検証
    const path = join(workspaceDir(), "docs", "guide.html");
    await waitFor(() => existsSync(path), { message: "書き出されない" });
    assert.match(
      await readFixture("docs/guide.html"),
      /"config":\{"colorTheme":"theme-slate"\}/,
    );
    const exported = await openExported(path, async (page) => {
      await page.emulateMedia({ colorScheme: "light" });
    });
    try {
      await exported.page.waitForSelector(".mdmark h1");
      const background = await exported.page.evaluate(() => {
        const root = document.querySelector(".mdmark");
        return root ? getComputedStyle(root).backgroundColor : "";
      });
      assert.strictEqual(background, "rgb(248, 250, 252)");
    } finally {
      await exported.close();
    }
  });
});

/** `window.print` を呼ばれた時刻と、その時の `details` の開閉を記録する */
async function recordPrint(page: playwright.Page): Promise<void> {
  await page.addInitScript(() => {
    const target = window as unknown as { __prints: unknown[] };
    target.__prints = [];
    // ブラウザの印刷は、ダイアログの前後に beforeprint・afterprint を送る
    window.print = () => {
      window.dispatchEvent(new Event("beforeprint"));
      target.__prints.push({
        drawn: document.querySelectorAll(".mdmark-embed[data-mdmark-drawn]")
          .length,
        details: [...document.querySelectorAll("details")].map(
          (item) => item.open,
        ),
      });
      window.dispatchEvent(new Event("afterprint"));
    };
  });
}

/** 記録した `window.print` の呼び出し */
async function prints(
  page: playwright.Page,
): Promise<Array<{ drawn: number; details: boolean[] }>> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __prints: Array<{ drawn: number; details: boolean[] }>;
        }
      ).__prints,
  );
}

suite("PDF に印刷", () => {
  let library: LibraryServer | undefined;

  suiteSetup(() => {
    installRecorder();
    installMessages();
    installOpenExternal();
  });
  suiteTeardown(async () => {
    await browser?.close();
    browser = undefined;
  });
  teardown(async () => {
    await library?.close();
    library = undefined;
    await chmod(join(workspaceDir(), "locked"), 0o755).catch(() => undefined);
    await resetEnvironment();
  });

  /** 外部ライブラリの印と閉じた `details` を持つ見本を開く */
  async function openPrintGuide(delayMs: number | "hang"): Promise<void> {
    library = await startLibraryServer({ delayMs });
    await writeFixture(
      "mdmark.config.yaml",
      `libraries:\n  my-lib: ${library.url}\n`,
    );
    await openGuide({
      extra:
        "<details><summary>概要</summary>本文</details>\n\n<!-- my-lib -->\n",
    });
    trackFile("docs/guide.html");
  }

  // 描き終えた後に印刷のダイアログを出す HTML を書き出して開く
  test("test_normal", async () => {
    // 準備
    await openPrintGuide(500);
    // 実行
    await vscode.commands.executeCommand("mdmark.printToPdf");
    // 検証
    assert.deepStrictEqual(opened, [exportedUrl("docs/guide.html")]);
    const path = join(workspaceDir(), "docs", "guide.html");
    const exported = await openExported(path, recordPrint);
    try {
      await exported.page.waitForFunction(
        () =>
          (window as unknown as { __prints: unknown[] }).__prints.length > 0,
      );
      await sleep(500);
      const calls = await prints(exported.page);
      assert.strictEqual(calls.length, 1);
      assert.strictEqual(calls[0]?.drawn, 1);
      assert.deepStrictEqual(calls[0]?.details, [true]);
    } finally {
      await exported.close();
    }
    // 続けて「ブラウザで開く」を呼ぶと、印刷を待つ処理が消える
    await vscode.commands.executeCommand("mdmark.openInBrowser");
    const again = await openExported(path, recordPrint);
    try {
      await again.page.waitForSelector(".mdmark-embed[data-mdmark-drawn]");
      await sleep(1000);
      assert.deepStrictEqual(await prints(again.page), []);
    } finally {
      await again.close();
    }
    assert.ok((await readFixture("docs/guide.html")).length > 0);
  });

  // 外部ライブラリが待ちの上限まで読み終わらなければ、そのまま印刷する
  test("test_normal_when_wait_limit_reached", async () => {
    // 準備
    await openPrintGuide("hang");
    await vscode.commands.executeCommand("mdmark.printToPdf");
    const path = join(workspaceDir(), "docs", "guide.html");
    const exported = await openExported(path, async (page) => {
      await recordPrint(page);
      await page.clock.install();
    });
    try {
      await exported.page.waitForSelector(".mdmark-embed");
      await waitFor(() => library?.requests() === 1, {
        message: "外部ライブラリを要求しない",
      });
      // 実行: 待ちの上限の前では呼ばれない
      await exported.page.clock.runFor(9000);
      await sleep(300);
      assert.deepStrictEqual(await prints(exported.page), []);
      // 上限を超えたところで 1 回呼ばれる
      await exported.page.clock.runFor(1500);
      await waitFor(async () => (await prints(exported.page)).length === 1, {
        message: "上限を超えても印刷しない",
      });
      await sleep(300);
      assert.strictEqual((await prints(exported.page)).length, 1);
    } finally {
      await exported.close();
    }
  });

  // mdmark.colorTheme で選んだテーマで書き出し、ブラウザがダークでも印刷の間はそのテーマの明るい配色にする
  test("test_normal_when_color_theme_selected", async () => {
    // 準備
    await setSetting("colorTheme", "theme-slate");
    // リンク 1 つだけの段落はカードにするため、文の中にリンクを置く
    await openGuide({
      extra: "詳しくは [リンク](https://example.com/) を見る。\n",
    });
    trackFile("docs/guide.html");
    // 実行
    await vscode.commands.executeCommand("mdmark.printToPdf");
    // 検証
    const path = join(workspaceDir(), "docs", "guide.html");
    const exported = await openExported(path, async (page) => {
      await page.emulateMedia({ colorScheme: "dark" });
      // 印刷のダイアログの代わりに、呼ばれたことだけを記録する
      await page.addInitScript(() => {
        const target = window as unknown as { __printed: boolean };
        target.__printed = false;
        window.print = () => {
          target.__printed = true;
        };
      });
    });
    /** リンクの色の計算値 */
    const readLinkColor = () =>
      exported.page.evaluate(() => {
        const link = document.querySelector(
          '.mdmark a[href^="https://example.com"]',
        );
        return link ? getComputedStyle(link).color : "";
      });
    try {
      await exported.page.waitForFunction(
        () => (window as unknown as { __printed: boolean }).__printed,
      );
      // ダークの画面では theme-slate の暗い配色（印刷にする前に確かめる）
      assert.strictEqual(await readLinkColor(), "rgb(125, 211, 252)");
      // 印刷のメディアでは、OS がダークでも theme-slate の明るい配色
      await exported.page.emulateMedia({ media: "print", colorScheme: "dark" });
      assert.strictEqual(await readLinkColor(), "rgb(29, 78, 216)");
    } finally {
      await exported.close();
    }
  });

  // 書き出せないときはブラウザを開かない
  test("test_error_when_output_unwritable", async () => {
    // 準備
    await openGuide();
    await createReadOnlyDir("locked");
    await setSetting("export.outputDir", "locked/out");
    // 実行
    await vscode.commands.executeCommand("mdmark.printToPdf");
    // 検証
    assert.strictEqual(messages.error.length, 1);
    assertExportFailedNotice(messages.error[0]);
    assert.deepStrictEqual(opened, []);
  });
});
