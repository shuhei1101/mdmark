import * as assert from "node:assert";
import { existsSync } from "node:fs";
import {
  chmod,
  cp,
  mkdir,
  readdir,
  readFile,
  writeFile,
} from "node:fs/promises";
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
  paramMarkdown,
  REPO_ROOT,
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

/** 見出し・表・注意書き・図と画像、本文の `</script>` を持つ見本の文書を `docs/guide.md` に書き込んで開く */
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

/** 脚注の番号が画面の途中に来るよう前に段落を並べ、`ts` のコードブロックを持つ文書 */
const TOOLTIP_SYNTAX_MARKDOWN = [
  "# 色分けと脚注",
  "",
  ...Array.from({ length: 6 }, (_, index) => `段落 ${index + 1}。\n`),
  "本文に脚注を付ける[^1]。",
  "",
  "```ts",
  "const answer: number = 42;",
  "```",
  "",
  "[^1]: 脚注の中身",
  "",
].join("\n");

/** Markdown が使用しない言語のモジュールの末尾に追加する目印 */
const UNUSED_LANGUAGE_SIGN = "unused-language-sign-484";

/** `@highlightjs/cdn-assets` の `es/` フォルダをワークスペースの `hljs/` に写す */
async function copyHighlight(): Promise<void> {
  await cp(
    join(REPO_ROOT, "node_modules", "@highlightjs", "cdn-assets", "es"),
    join(workspaceDir(), "hljs"),
    { recursive: true },
  );
  trackFile("hljs");
}

/** 書き出した HTML の `file:` の URL */
function exportedUrl(relative: string): string {
  return pathToFileURL(join(workspaceDir(), relative)).href;
}

/** 書き出せない通知の文: 書き出す先のパスと、OS が返却した理由を含む */
function assertExportFailedNotice(message: string | undefined): void {
  const path = join(workspaceDir(), "locked", "out", "guide.html");
  assert.ok(message, "書き出せない通知が出ていない");
  assert.ok(message.startsWith(`HTML を書き出せませんでした: ${path}（`));
  assert.ok(message.includes("EACCES"));
  assert.ok(
    message.endsWith(
      "）。設定 mdmark.export.outputDir を書き込めるフォルダに修正してください。",
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

/** 書き出した HTML に埋めた本文と設定の JSON */
function exportedData(html: string): {
  config: {
    libraries?: Record<string, string>;
    "html-scripts"?: { url?: string };
    mermaid?: { url?: string };
    tooltips?: { placement?: string };
    syntax?: { url?: string };
  };
} {
  const found = html.match(
    /<script type="application\/json" id="mdmark-data">([\s\S]*?)<\/script>/,
  );
  assert.ok(found?.[1], "埋めた JSON が無い");
  return JSON.parse(found[1]);
}

/** 書き出した HTML の `data:` の URL をすべて復号してつなげる */
function decodedDataUrls(html: string): string {
  return [...html.matchAll(/data:text\/javascript;charset=utf-8,([^"\\]+)/g)]
    .map((match) => decodeURIComponent(match[1] ?? ""))
    .join("\n");
}

/** マーカーの無いライブラリの目印の文字列 */
const UNUSED_LIBRARY_SIGN = "unused-library-sign-369";

/** 相対パスの `libraries` と `html-scripts.url` を記載した設定と、手元のライブラリを配置する */
async function writeLocalLibraries(): Promise<void> {
  await writeFixture(
    "libs/test-lib.js",
    'import { label } from "./label.js";\nexport function draw(slot) { slot.textContent = label; }\n',
  );
  await writeFixture("libs/label.js", 'export const label = "drawn-local";\n');
  await writeFixture(
    "libs/unused.js",
    `export function draw(slot) { slot.textContent = "${UNUSED_LIBRARY_SIGN}"; }\n`,
  );
  const babel = await readFile(
    join(REPO_ROOT, "node_modules", "@babel", "standalone", "babel.min.js"),
    "utf8",
  );
  await writeFixture(
    "libs/babel.mjs",
    `const module = { exports: {} };\nconst exports = module.exports;\n${babel}\nexport default module.exports;\n`,
  );
  await writeFixture(
    "mdmark.config.yaml",
    [
      "libraries:",
      "  test-lib: ./libs/test-lib.js",
      "  unused-lib: ./libs/unused.js",
      "features:",
      "  html-scripts: true",
      "html-scripts:",
      "  url: ./libs/babel.mjs",
      "",
    ].join("\n"),
  );
}

/** `test-lib` のマーカーと、`.box` に記載する `ts` の範囲 */
const LOCAL_LIBRARIES_EXTRA = [
  "<!-- test-lib -->",
  "",
  "<!-- html -->",
  "",
  "```html",
  '<div class="box">ノード</div>',
  "```",
  "",
  "```ts",
  "export default (root: HTMLElement): void => {",
  '  const box = root.querySelector<HTMLElement>(".box");',
  "  if (box) {",
  '    box.textContent = "ran-ts";',
  "  }",
  "};",
  "```",
  "",
  "<!-- /html -->",
  "",
].join("\n");

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
      await exported.page.waitForSelector(
        'figure.mdmark-diagram[data-diagram="map"]',
      );
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

  // outputDir のフォルダに書き込み、保存していない書き換えも入れる
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

  // 書き出す先に書き込めないとき、理由を通知して何も残さない
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

  // 相対パスの mermaid.url を、本体と chunk をまとめた data: の URL で埋め、Chromium で file:// で開いて描く
  test("test_normal_when_relative_mermaid", async function () {
    // 5MB の mermaid を esbuild-wasm でまとめる書き出しを最大 120 秒待つ
    this.timeout(150000);
    // 準備
    const dist = join(REPO_ROOT, "node_modules", "mermaid", "dist");
    await cp(
      join(dist, "mermaid.esm.min.mjs"),
      join(workspaceDir(), "libs", "mermaid", "mermaid.esm.min.mjs"),
    );
    await cp(
      join(dist, "chunks", "mermaid.esm.min"),
      join(workspaceDir(), "libs", "mermaid", "chunks", "mermaid.esm.min"),
      { recursive: true },
    );
    trackFile("libs/mermaid");
    await writeFixture(
      "mdmark.config.yaml",
      "mermaid:\n  url: ./libs/mermaid/mermaid.esm.min.mjs\n",
    );
    await writeFixture(
      "docs/flow.md",
      "# 図\n\n```mermaid\nflowchart LR\n  A[受付] --> B[回答]\n```\n",
    );
    await openMarkdown("docs/flow.md");
    trackFile("docs/flow.html");
    // 実行
    await vscode.commands.executeCommand("mdmark.exportHtml");
    // 検証
    const path = join(workspaceDir(), "docs", "flow.html");
    await waitFor(() => existsSync(path), {
      message: "書き出されない",
      timeout: 120_000,
    });
    const html = await readFixture("docs/flow.html");
    const { config } = exportedData(html);
    assert.ok(config.mermaid?.url?.startsWith("data:text/javascript"));
    const exported = await openExported(path);
    try {
      await exported.page.waitForSelector(
        'figure.mdmark-diagram[data-diagram="mermaid"] .mdmark-mermaid > svg',
        { timeout: 60_000 },
      );
      assert.strictEqual(
        await exported.page.locator(".mdmark-notice").count(),
        0,
      );
    } finally {
      await exported.close();
    }
  });

  // 相対パスの syntax.url の本体と文書が使用する言語のモジュールを data: の URL にして import map で割り当て、Chromium で file:// で開いて色分けし、ツールチップを参照の下に出す（正常系（ツールチップの位置と相対パスの色分けのライブラリ））
  test("test_normal_when_tooltips_and_relative_syntax", async function () {
    // 本体と言語のモジュールを esbuild-wasm でまとめる書き出しを最大 60 秒待つ
    this.timeout(90000);
    // 準備
    await copyHighlight();
    const unused = join(workspaceDir(), "hljs", "languages", "python.min.js");
    await writeFile(
      unused,
      `${await readFile(unused, "utf8")}\n// ${UNUSED_LANGUAGE_SIGN}\n`,
    );
    await writeFixture(
      "mdmark.config.yaml",
      "tooltips:\n  placement: bottom\nsyntax:\n  url: ./hljs/\n",
    );
    await writeFixture("docs/syntax.md", TOOLTIP_SYNTAX_MARKDOWN);
    await openMarkdown("docs/syntax.md");
    trackFile("docs/syntax.html");
    // 実行
    await vscode.commands.executeCommand("mdmark.exportHtml");
    // 検証: 埋めた設定と import map
    const path = join(workspaceDir(), "docs", "syntax.html");
    await waitFor(() => existsSync(path), {
      message: "書き出されない",
      timeout: 60_000,
    });
    const html = await readFixture("docs/syntax.html");
    const { config } = exportedData(html);
    assert.deepStrictEqual(config.tooltips, { placement: "bottom" });
    const folder = `${pathToFileURL(join(workspaceDir(), "hljs")).href}/`;
    assert.strictEqual(config.syntax?.url, folder);
    const importMap = /<script type="importmap">([\s\S]*?)<\/script>/.exec(
      html,
    )?.[1];
    assert.ok(importMap, "import map が無い");
    const { imports } = JSON.parse(importMap) as {
      imports: Record<string, string>;
    };
    assert.deepStrictEqual(Object.keys(imports).sort(), [
      `${folder}core.min.js`,
      `${folder}languages/typescript.min.js`,
    ]);
    for (const url of Object.values(imports)) {
      assert.ok(url.startsWith("data:text/javascript"), url.slice(0, 40));
    }
    assert.ok(!decodedDataUrls(html).includes(UNUSED_LANGUAGE_SIGN));
    // 検証: file:// で開いて色分けし、ツールチップを参照の下に出す
    const fileRequests: string[] = [];
    const exported = await openExported(path, async (page) => {
      page.on("request", (request) => {
        if (request.url().startsWith("file:")) {
          fileRequests.push(request.url());
        }
      });
    });
    try {
      await exported.page.waitForSelector('pre code [class^="hljs-"]');
      assert.strictEqual(
        await exported.page.locator(".mdmark-notice").count(),
        0,
      );
      await exported.page.focus(".mdmark-fn-link");
      await exported.page.waitForSelector(
        ".mdmark-fn-ref.is-open .mdmark-fn-tip",
      );
      const link = await exported.page.locator(".mdmark-fn-link").boundingBox();
      const tip = await exported.page
        .locator(".mdmark-fn-ref.is-open .mdmark-fn-tip")
        .boundingBox();
      assert.ok(link && tip);
      assert.ok(
        tip.y >= link.y + link.height - 1,
        JSON.stringify({ link, tip }),
      );
      assert.deepStrictEqual(
        fileRequests.filter((url) => url !== exportedUrl("docs/syntax.html")),
        [],
      );
    } finally {
      await exported.close();
    }
  });

  // 相対パスの libraries と html-scripts.url を data: の URL で埋め、Chromium で file:// で開いて描く
  test("test_normal_when_relative_libraries", async () => {
    // 準備
    await writeLocalLibraries();
    await writeFixture(
      "docs/guide.md",
      `# 手元のライブラリ\n\n${LOCAL_LIBRARIES_EXTRA}`,
    );
    await openMarkdown("docs/guide.md");
    trackFile("docs/guide.html");
    // 実行
    await vscode.commands.executeCommand("mdmark.exportHtml");
    // 検証
    const path = join(workspaceDir(), "docs", "guide.html");
    await waitFor(() => existsSync(path), { message: "書き出されない" });
    const html = await readFixture("docs/guide.html");
    const { config } = exportedData(html);
    assert.ok(
      config.libraries?.["test-lib"]?.startsWith("data:text/javascript"),
    );
    assert.ok(config["html-scripts"]?.url?.startsWith("data:text/javascript"));
    assert.ok(!Object.hasOwn(config.libraries ?? {}, "unused-lib"));
    assert.ok(!decodedDataUrls(html).includes(UNUSED_LIBRARY_SIGN));
    const fileRequests: string[] = [];
    const exported = await openExported(path, async (page) => {
      page.on("request", (request) => {
        if (request.url().startsWith("file:")) {
          fileRequests.push(request.url());
        }
      });
    });
    try {
      await exported.page.waitForFunction(
        () =>
          document.querySelector(".mdmark-embed")?.textContent ===
            "drawn-local" &&
          document.querySelector(".box")?.textContent === "ran-ts",
      );
      assert.strictEqual(
        await exported.page.locator(".mdmark-notice").count(),
        0,
      );
      assert.deepStrictEqual(
        fileRequests.filter((url) => url !== exportedUrl("docs/guide.html")),
        [],
      );
    } finally {
      await exported.close();
    }
  });

  // mdmark.preview.theme によらず、設定ファイルの colorScheme を埋めた HTML を書き出す
  test("test_normal_when_config_color_scheme", async () => {
    // 準備
    await writeFixture("mdmark.config.yaml", "colorScheme: dark\n");
    await openGuide();
    await setSetting("preview.theme", "light");
    trackFile("docs/guide.html");
    // 実行
    await vscode.commands.executeCommand("mdmark.exportHtml");
    // 検証
    const path = join(workspaceDir(), "docs", "guide.html");
    await waitFor(() => existsSync(path), { message: "書き出されない" });
    assert.match(await readFixture("docs/guide.html"), /"colorScheme":"dark"/);
    const exported = await openExported(path, async (page) => {
      await page.emulateMedia({ colorScheme: "light" });
    });
    try {
      await exported.page.waitForSelector(".mdmark h1");
      const root = await exported.page.evaluate(() => {
        const element = document.querySelector("[data-mdmark-color-theme]");
        return {
          dark: element?.classList.contains("mdmark-theme-dark") ?? false,
          background: element
            ? getComputedStyle(element)
                .getPropertyValue("--mdmark-color-bg")
                .trim()
            : "",
        };
      });
      assert.deepStrictEqual(root, { dark: true, background: "#131316" });
    } finally {
      await exported.close();
    }
  });

  // 設定ファイルの labels を埋めた HTML を書き出し、開いた HTML で操作できる部品のボタンを設定の文言で描く
  test("test_normal_when_param_copy_label", async () => {
    // 準備
    await writeFixture("mdmark.config.yaml", "labels:\n  paramCopy: コピー\n");
    await openGuide({ extra: await paramMarkdown() });
    trackFile("docs/guide.html");
    // 実行
    await vscode.commands.executeCommand("mdmark.exportHtml");
    // 検証
    const path = join(workspaceDir(), "docs", "guide.html");
    await waitFor(() => existsSync(path), { message: "書き出されない" });
    assert.match(
      await readFixture("docs/guide.html"),
      /"labels":\{"paramCopy":"コピー"\}/,
    );
    const exported = await openExported(path);
    try {
      const button = exported.page.locator("button.mdmark-param-copy");
      await button.waitFor();
      assert.strictEqual(await button.textContent(), "コピー");
    } finally {
      await exported.close();
    }
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
    // ブラウザの印刷は、ダイアログの前後に beforeprint・afterprint を送信する
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

  /** 外部ライブラリのマーカーと閉じた `details` を持つ見本を開く */
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

  // 外部ライブラリが待ちの上限まで読み込み終わらなければ、そのまま印刷する
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
    // リンク 1 つだけの段落はカードにするため、文の中にリンクを配置する
    await openGuide({
      extra: "詳しくは [リンク](https://example.com/) を確認する。\n",
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
      // ダークの画面では theme-slate の暗い配色（印刷にする前に確認する）
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
