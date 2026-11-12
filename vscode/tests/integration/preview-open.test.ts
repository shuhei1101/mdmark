import * as assert from "node:assert";
import { cp, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import * as vscode from "vscode";
import {
  audit,
  clickInPreview,
  distPath,
  distRequests,
  EXTENSION_ID,
  extensionLogSince,
  extensionLogSize,
  focusInPreview,
  guideMarkdown,
  inspect,
  installMessages,
  installOpenExternal,
  installRecorder,
  lastPanel,
  opened as openedUrls,
  openMarkdown,
  REPO_ROOT,
  recordedPanels,
  renders,
  resetEnvironment,
  STUB_ORIGIN,
  setSetting,
  sleep,
  stub,
  tagRequestCount,
  trackFile,
  waitFor,
  waitForRendered,
  workspaceDir,
  writeFixture,
} from "./helpers.ts";

/** 用語のエイリアスの行を 1 つ持つ設定ファイル */
const ALIAS_CONFIG = [
  "aliases:",
  "  - id: terms",
  "    paths: [glossary.yaml]",
  "    alias_type: term",
  "    records: terms",
  "",
].join("\n");

/** 名前 `描画`・別名 `レンダリング` の用語 1 件を持つ YAML */
const GLOSSARY = (meaning: string) =>
  [
    "terms:",
    "  - id: render",
    "    name: 描画",
    "    aliases: [レンダリング]",
    `    description: ${meaning}`,
    "",
  ].join("\n");

/** 1 x 1 の PNG */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** パネルを閉じ、プレビューを開いた Markdown のエディタも閉じる */
async function closePreviews(): Promise<void> {
  for (const record of recordedPanels().splice(0)) {
    record.panel.dispose();
  }
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  // 閉じる前の読み込みの要求が、後の要求の記録に混ざらないよう待つ
  await sleep(500);
}

/** 範囲に html・css・ts を配置し、ts がノードを押すと根の要素に class `is-open` を付与・解除する文書 */
const RANGE_SCRIPT_MARKDOWN = [
  "# 見出し",
  "",
  "<!-- html -->",
  "",
  "```html",
  '<div class="box">ノード</div>',
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

/** 範囲の `ts` の変換のライブラリ（`@babel/standalone` の UMD）を、既定のエクスポートを持つ ES モジュールに包んで配る手元の配信を起動する */
async function startTranspilerServer(): Promise<{
  url: string;
  requests: () => number;
  close: () => void;
}> {
  const body = await readFile(
    join(REPO_ROOT, "node_modules", "@babel", "standalone", "babel.min.js"),
    "utf8",
  );
  let count = 0;
  const server = createServer((_request, response) => {
    count += 1;
    response.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    response.end(
      `const module = { exports: {} };\nconst exports = module.exports;\n${body}\nexport default module.exports;\n`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/babel.mjs`,
    requests: () => count,
    close: () => server.close(),
  };
}

/** mermaid（`mermaid@12.3.0` の `dist/` の本体と chunk）を、jsDelivr と同じパス `/npm/mermaid@12.3.0/dist/` で配る手元の配信を起動する */
async function startMermaidServer(): Promise<{
  url: string;
  requests: () => number;
  close: () => void;
}> {
  const dist = join(REPO_ROOT, "node_modules", "mermaid", "dist");
  const prefix = "/npm/mermaid@12.3.0/dist/";
  let count = 0;
  const server = createServer((request, response) => {
    const path = (request.url ?? "").split("?")[0] ?? "";
    const file = join(dist, path.slice(prefix.length));
    if (
      !path.startsWith(prefix) ||
      !file.startsWith(dist) ||
      !file.endsWith(".mjs")
    ) {
      response.writeHead(404);
      response.end();
      return;
    }
    count += 1;
    readFile(file).then(
      (body) => {
        response.writeHead(200, {
          "Content-Type": "text/javascript; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        });
        response.end(body);
      },
      () => {
        response.writeHead(404);
        response.end();
      },
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}${prefix}mermaid.esm.min.mjs`,
    requests: () => count,
    close: () => server.close(),
  };
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

/** `@highlightjs/cdn-assets` の `es/` フォルダをワークスペースの `hljs/` に写す */
async function copyHighlight(): Promise<void> {
  await cp(
    join(REPO_ROOT, "node_modules", "@highlightjs", "cdn-assets", "es"),
    join(workspaceDir(), "hljs"),
    { recursive: true },
  );
  trackFile("hljs");
}

suite("プレビューを開く", () => {
  suiteSetup(() => {
    installRecorder();
    installMessages();
    installOpenExternal();
  });
  teardown(resetEnvironment);

  // タグ一覧から最新のバージョンを選び、横の列のパネルに描かせる
  test("test_normal", async () => {
    // 準備
    await stub.setTags(["v0.7.0", "v0.10.0", "v0.6.0", "vscode-v0.11.0"]);
    await writeFixture("guide.md", await guideMarkdown());
    await openMarkdown("guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    // 検証
    assert.strictEqual(record.options.showOptions, vscode.ViewColumn.Beside);
    assert.strictEqual(record.options.title, "プレビュー guide.md");
    assert.deepStrictEqual((await distRequests()).sort(), [
      distPath("v0.10.0", "index.css"),
      distPath("v0.10.0", "index.js"),
    ]);
    assert.strictEqual(await tagRequestCount(), 1);
    // 前回のバージョンが v0.10.0 になったことを、タグ一覧が応えない状態のリロードで確認する
    await stub.setMode({ tags: "hang", dist: "ok" });
    await stub.clear();
    await vscode.commands.executeCommand("mdmark.refreshPreview");
    await waitForRendered(record, 2);
    assert.ok((await distRequests()).includes(distPath("v0.10.0", "index.js")));
    // Webview の本文
    for (const selector of [
      "h1",
      ".mdmark-table",
      ".markdown-alert",
      ".mdmark-diagram-frame",
    ]) {
      assert.ok(
        (await inspect(selector)).length > 0,
        `${selector} が描かれていない`,
      );
    }
    // パネルの部品にアクセシビリティの違反が無い
    assert.deepStrictEqual(await audit(), []);
    // CSP と nonce
    const html = record.panel.webview.html;
    const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/
      .exec(html)?.[1]
      ?.replaceAll("&#39;", "'");
    const nonce = /<script[^>]*nonce="([^"]*)"/.exec(html)?.[1];
    assert.ok(csp && nonce);
    const cspSource = record.panel.webview.cspSource;
    assert.strictEqual(
      csp,
      [
        "default-src 'none'",
        `script-src 'nonce-${nonce}' ${STUB_ORIGIN} https://cdn.jsdelivr.net ${cspSource}`,
        `style-src ${STUB_ORIGIN} ${cspSource} 'unsafe-inline'`,
        `img-src ${cspSource} https: data:`,
        `media-src ${cspSource} https: data:`,
        `font-src ${STUB_ORIGIN} ${cspSource}`,
        `connect-src ${STUB_ORIGIN} https://cdn.jsdelivr.net`,
      ].join("; "),
    );
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    assert.ok(scripts.length > 0);
    for (const tag of scripts) {
      assert.ok(tag.includes(`nonce="${nonce}"`), tag);
    }
  });

  // mermaid の読み込み先の origin を CSP に入れ、違反を出さずに mermaid の図を描く（正常系（mermaid のコードブロック））
  test("test_normal_when_mermaid", async function () {
    // 5MB の mermaid の読み込みと描画を最大 60 秒待つ
    this.timeout(90000);
    // 準備
    const mermaid = await startMermaidServer();
    try {
      await stub.setTags(["v0.10.0"]);
      await writeFixture(
        "flow.md",
        "# 図\n\n```mermaid\nflowchart LR\n  A[受付] --> B[回答]\n```\n",
      );
      await writeFixture(
        "mdmark.config.yaml",
        `mermaid:\n  url: ${mermaid.url}\n`,
      );
      await openMarkdown("flow.md");
      // 実行
      await vscode.commands.executeCommand("mdmark.openPreviewToSide");
      const record = lastPanel();
      await waitForRendered(record);
      // 検証: mermaid の図
      await waitFor(
        async () =>
          (
            await inspect(
              'figure.mdmark-diagram[data-diagram="mermaid"] .mdmark-mermaid > svg',
            )
          ).length === 1,
        { message: "mermaid の図を描かない", timeout: 60_000 },
      );
      assert.ok(mermaid.requests() > 0);
      assert.strictEqual((await inspect(".mdmark-notice")).length, 0);
      // 検証: CSP
      const html = record.panel.webview.html;
      const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/
        .exec(html)?.[1]
        ?.replaceAll("&#39;", "'");
      const scriptSrc = csp
        ?.split("; ")
        .find((directive) => directive.startsWith("script-src "));
      assert.ok(scriptSrc);
      assert.ok(scriptSrc.includes(new URL(mermaid.url).origin), scriptSrc);
      for (const word of ["blob:", "'unsafe-inline'", "'unsafe-eval'"]) {
        assert.ok(!scriptSrc.includes(word), scriptSrc);
      }
      const [root] = await inspect("html");
      assert.strictEqual(root?.attributes["data-mdmark-csp-violations"], "0");
    } finally {
      mermaid.close();
    }
  });

  // 設定の tooltips と、設定ファイルのフォルダから解決した syntax.url を mount に指定し、手元の色分けのライブラリで色分けしてツールチップを参照の下に出す（正常系（ツールチップの位置と相対パスの色分けのライブラリ））
  test("test_normal_when_tooltips_and_relative_syntax", async () => {
    // 準備
    await stub.setTags(["v0.10.0"]);
    await copyHighlight();
    await writeFixture("guide.md", TOOLTIP_SYNTAX_MARKDOWN);
    await writeFixture(
      "mdmark.config.yaml",
      "tooltips:\n  placement: bottom\nsyntax:\n  url: ./hljs/\n",
    );
    await openMarkdown("guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    // 検証: mount に指定した設定
    const config = renders(record).at(-1)?.config;
    assert.deepStrictEqual(config?.tooltips, { placement: "bottom" });
    const syntaxUrl = String(config?.syntax?.url ?? "");
    assert.ok(syntaxUrl.endsWith("/hljs/"), syntaxUrl);
    assert.ok(!syntaxUrl.startsWith("./"), syntaxUrl);
    // 検証: 手元の色分けのライブラリで色分けする
    await waitFor(
      async () => (await inspect('pre code [class^="hljs-"]')).length > 0,
      { message: "色分けしない" },
    );
    assert.strictEqual((await inspect(".mdmark-notice")).length, 0);
    // 検証: ツールチップを参照の下に出す
    focusInPreview(record, ".mdmark-fn-link");
    await waitFor(
      async () => (await inspect(".mdmark-fn-ref.is-open")).length === 1,
      { message: "脚注のツールチップを開かない" },
    );
    const [link] = await inspect(".mdmark-fn-link");
    const [tip] = await inspect(".mdmark-fn-ref.is-open .mdmark-fn-tip");
    assert.ok(link && tip);
    assert.ok(
      tip.top >= link.top + link.height - 1,
      JSON.stringify({ link, tip }),
    );
    // 検証: CSP の違反
    const [root] = await inspect("html");
    assert.strictEqual(root?.attributes["data-mdmark-csp-violations"], "0");
  });

  // CSP を広げずに、範囲の ts をページの nonce を付けた script 要素で動かす（正常系（範囲のスクリプトと CSS））
  test("test_normal_when_range_scripts", async () => {
    // 準備
    const transpiler = await startTranspilerServer();
    try {
      await stub.setTags(["v0.10.0"]);
      await writeFixture("guide.md", RANGE_SCRIPT_MARKDOWN);
      await writeFixture(
        "mdmark.config.yaml",
        [
          "features:",
          "  html-scripts: true",
          "html-scripts:",
          `  url: ${transpiler.url}`,
          "",
        ].join("\n"),
      );
      await openMarkdown("guide.md");
      // 実行
      await vscode.commands.executeCommand("mdmark.openPreviewToSide");
      const record = lastPanel();
      await waitForRendered(record);
      // 検証: 範囲の css を根の要素に限って当て、ts を動かす
      await waitFor(() => transpiler.requests() === 1, {
        message: "変換のライブラリを読み込まない",
      });
      assert.strictEqual((await inspect(".mdmark-html-style")).length, 1);
      assert.strictEqual(
        (await inspect('.mdmark-html[data-html-scope="0"] .box')).length,
        1,
      );
      await waitFor(
        async () => {
          clickInPreview(record, ".mdmark-html .box");
          await sleep(200);
          const root = (await inspect(".mdmark-html"))[0];
          return root?.className.split(" ").includes("is-open") === true;
        },
        { message: "範囲の ts が動かない" },
      );
      // 検証: CSP
      const html = record.panel.webview.html;
      const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/
        .exec(html)?.[1]
        ?.replaceAll("&#39;", "'");
      const scriptSrc = csp
        ?.split("; ")
        .find((directive) => directive.startsWith("script-src "));
      assert.ok(scriptSrc);
      assert.ok(scriptSrc.includes(new URL(transpiler.url).origin), scriptSrc);
      for (const word of ["blob:", "'unsafe-inline'", "'unsafe-eval'"]) {
        assert.ok(!scriptSrc.includes(word), scriptSrc);
      }
      const [root] = await inspect("html");
      assert.strictEqual(root?.attributes["data-mdmark-csp-violations"], "0");
      assert.strictEqual((await inspect(".mdmark-notice")).length, 0);
      assert.strictEqual((await inspect(".mdmark-syntax-warning")).length, 0);
    } finally {
      transpiler.close();
    }
  });

  // 設定の aliases から作ったエイリアスを render で送信し、mount の opts.aliases に指定して下線とツールチップを出す
  test("test_normal_when_aliases", async () => {
    // 準備
    await writeFixture("mdmark.config.yaml", ALIAS_CONFIG);
    await writeFixture(
      "glossary.yaml",
      GLOSSARY("Markdown を HTML にすること"),
    );
    await writeFixture("guide.md", "# 案内\n\nレンダリングの段落\n");
    await openMarkdown("guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    // 検証
    const aliases = renders(record).at(-1)?.aliases ?? [];
    assert.strictEqual(aliases.length, 1);
    assert.strictEqual(aliases[0]?.alias_type, "term");
    assert.strictEqual(aliases[0]?.name, "描画");
    assert.deepStrictEqual(aliases[0]?.aliases, ["レンダリング"]);
    const terms = await inspect(".mdmark-term");
    assert.ok(terms.some((term) => term.text === "レンダリング"));
    const tips = await inspect('[role="tooltip"]');
    assert.ok(
      tips.some(
        (tip) =>
          tip.text.includes("用語") &&
          tip.text.includes("描画") &&
          tip.text.includes("Markdown を HTML にすること"),
      ),
      JSON.stringify(tips.map((tip) => tip.text)),
    );
  });

  // aliases の行の paths に該当するファイルが無いとき、その行を除いたエイリアスで描き、出力チャネルに警告を記載する
  test("test_error_when_aliases_missing", async () => {
    // 準備
    await writeFixture(
      "mdmark.config.yaml",
      [
        ALIAS_CONFIG.trimEnd(),
        "  - id: missing",
        "    paths: [missing/*.yaml]",
        "    alias_type: term",
        "",
      ].join("\n"),
    );
    await writeFixture(
      "glossary.yaml",
      GLOSSARY("Markdown を HTML にすること"),
    );
    await writeFixture("guide.md", "# 案内\n\nレンダリングの段落\n");
    await openMarkdown("guide.md");
    const logOffset = await extensionLogSize();
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    // 検証
    const aliases = renders(record).at(-1)?.aliases ?? [];
    assert.deepStrictEqual(
      aliases.map((alias) => alias.name),
      ["描画"],
    );
    await waitFor(
      async () =>
        (await extensionLogSince(logOffset)).some((line) =>
          line.includes("mdmark.config.yaml:aliases[1].paths: alias_no_files:"),
        ),
      { message: "エイリアスのずれの警告が出力チャネルに出ない" },
    );
    assert.ok(!record.sent.some((message) => message.type === "configError"));
  });

  // include のマーカーの取り込み先をワークスペースから読み込んで指定し、プレビューに描かせる
  test("test_normal_when_includes", async () => {
    // 準備
    await writeFixture(
      "docs/guide.md",
      [
        "# 案内",
        "",
        "<!-- include: 共通/手順.md#実行 -->",
        "",
        "<!-- include: missing.md -->",
        "",
      ].join("\n"),
    );
    const procedure = "## 準備\n\n準備の段落\n\n## 実行\n\n実行の段落\n";
    await writeFixture("docs/共通/手順.md", procedure);
    await openMarkdown("docs/guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    // 検証
    assert.deepStrictEqual(renders(record).at(-1)?.includes, {
      "共通/手順.md": procedure,
    });
    const include = await inspect(".mdmark-include");
    assert.ok(include.some((item) => item.text.includes("実行の段落")));
    assert.ok(!include.some((item) => item.text.includes("準備の段落")));
    assert.ok((await inspect(".mdmark-syntax-warning")).length > 0);
  });

  // mdmark.openPreview は同じ列のタブに開く
  test("test_normal_when_same_column", async () => {
    // 準備
    await writeFixture("guide.md", await guideMarkdown());
    const editor = await openMarkdown("guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreview");
    const record = lastPanel();
    await waitForRendered(record);
    // 検証
    assert.strictEqual(record.options.showOptions, vscode.ViewColumn.Active);
    assert.strictEqual(record.panel.viewColumn, editor.viewColumn);
  });

  // 同じ Markdown のパネルがあれば、作らずに表に出す
  test("test_normal_when_already_open", async () => {
    // 準備
    await writeFixture("guide.md", await guideMarkdown());
    await writeFixture("other.md", "# 別の文書\n");
    const guide = vscode.Uri.file(join(workspaceDir(), "guide.md"));
    await openMarkdown("guide.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    // パネルの列で別のタブを表にしておく
    const other = await vscode.workspace.openTextDocument(
      vscode.Uri.file(join(workspaceDir(), "other.md")),
    );
    await vscode.window.showTextDocument(other, record.panel.viewColumn);
    await waitFor(() => !record.panel.visible, {
      message: "パネルが背面に回らない",
    });
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide", guide);
    // 検証
    await waitFor(() => record.panel.visible, {
      message: "パネルが表に出ない",
    });
    assert.strictEqual(recordedPanels().length, 1);
    assert.strictEqual(await tagRequestCount(), 1);
  });

  // mdmark.version に記載したバージョンを、タグ一覧を取らずに読み込む
  test("test_normal_when_version_pinned", async () => {
    // 準備: 前回のバージョンを v0.7.0 にする
    await stub.setTags(["v0.7.0"]);
    await writeFixture("guide.md", await guideMarkdown());
    await openMarkdown("guide.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    await waitForRendered(lastPanel());
    await closePreviews();
    await setSetting("version", "v0.6.0");
    await stub.clear();
    await openMarkdown("guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    // 検証
    assert.deepStrictEqual((await distRequests()).sort(), [
      distPath("v0.6.0", "index.css"),
      distPath("v0.6.0", "index.js"),
    ]);
    assert.strictEqual(await tagRequestCount(), 0);
    // 前回のバージョンが v0.7.0 のままであることを、固定を削除してタグ一覧が応えない状態で開いて確認する
    await closePreviews();
    await setSetting("version", undefined);
    await stub.setMode({ tags: "hang", dist: "ok" });
    await stub.clear();
    await openMarkdown("guide.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    await waitForRendered(lastPanel());
    assert.ok((await distRequests()).includes(distPath("v0.7.0", "index.js")));
  });

  // タグ一覧が待ちの上限まで返らないとき、前回のバージョンで描く
  test("test_normal_when_tags_unreachable", async () => {
    // 準備: 前回のバージョンを v0.6.0 にする
    await stub.setTags(["v0.6.0"]);
    await writeFixture("guide.md", await guideMarkdown());
    await openMarkdown("guide.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    await waitForRendered(lastPanel());
    await closePreviews();
    await stub.setTags(["v0.10.0"]);
    await stub.setMode({ tags: "hang", dist: "ok" });
    await stub.clear();
    await openMarkdown("guide.md");
    const logOffset = await extensionLogSize();
    // 実行
    const start = Date.now();
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitFor(async () =>
      (await distRequests()).includes(distPath("v0.6.0", "index.js")),
    );
    const elapsed = Date.now() - start;
    await waitForRendered(record);
    // 検証: 待ちの上限（3 秒）より前には要求せず、待ちの上限の中断の合図で /tags の要求を打ち切ってから要求する
    // 負荷で遅れるコマンドの経過時間には上限を置かず、/tags の要求を受けてから打ち切られるまでの時間に上限を置く
    const tagsClosed = async () => {
      const tagRequests = await stub.tagRequests();
      return (
        tagRequests.length > 0 &&
        tagRequests.every(({ closedAt }) => closedAt !== null)
      );
    };
    await waitFor(tagsClosed, { timeout: 5000 }).catch(() => undefined);
    const abortedWithin = (await stub.tagRequests()).every(
      ({ receivedAt, closedAt }) =>
        closedAt !== null && closedAt - receivedAt < 6000,
    );
    // 前回のバージョンは、タグ一覧を取れない旨を記録した後に決めて要求する。出力チャネルがログファイルへ書き込むまで待つ
    const loggedTimeout = async () =>
      (await extensionLogSince(logOffset)).some(
        (line) =>
          line.includes("タグ一覧を取れない") && line.includes("TimeoutError"),
      );
    await waitFor(loggedTimeout, { timeout: 5000 }).catch(() => undefined);
    const timedOut = await loggedTimeout();
    if (
      !(elapsed >= 2800 && (await tagsClosed()) && abortedWithin && timedOut)
    ) {
      // 出力チャネルがログファイルへ書き込み終えるのを待つ
      await sleep(1000);
      const timings = (await stub.tagRequests()).map(
        ({ receivedAt, closedAt }) =>
          `受けた +${receivedAt - start} ms・閉じられた ${closedAt === null ? "まだ" : `+${closedAt - start} ms`}`,
      );
      const reasons = (await extensionLogSince(logOffset)).filter((line) =>
        line.includes("タグ一覧を取れない"),
      );
      assert.fail(
        [
          `要求まで ${elapsed} ms ${JSON.stringify(await stub.requests())}`,
          `/tags の要求（開いた時刻から）: ${timings.join(" / ") || "なし"}`,
          `拡張機能のログ: ${reasons.join(" / ") || "なし"}`,
        ].join("\n"),
      );
    }
    assert.strictEqual((await inspect(".mdmark-preview-notice")).length, 0);
    // 403 を返却する代役でも、待たずに前回のバージョンで描く
    await closePreviews();
    await stub.setMode({ tags: "forbidden", dist: "ok" });
    await stub.clear();
    await openMarkdown("guide.md");
    const startForbidden = Date.now();
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    await waitForRendered(lastPanel());
    assert.ok(Date.now() - startForbidden < 2800);
    assert.ok((await distRequests()).includes(distPath("v0.6.0", "index.js")));
  });

  // 配色を固定する設定を、描く先を包む要素の class にし、auto に戻すと削除する
  test("test_normal_when_theme_fixed", async () => {
    // 準備
    await setSetting("preview.theme", "light");
    await writeFixture("guide.md", await guideMarkdown());
    await openMarkdown("guide.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    // 検証: light の間
    const [fixed] = await inspect("#mdmark-preview");
    assert.ok(fixed?.className.split(" ").includes("mdmark-theme-light"));
    assert.ok(!fixed?.className.split(" ").includes("mdmark-theme-dark"));
    // 実行: auto にする
    await setSetting("preview.theme", "auto");
    await waitForRendered(record, 2);
    // 検証: パネルをもう一度開かずに class が削除される
    const [released] = await inspect("#mdmark-preview");
    assert.ok(!released?.className.includes("mdmark-theme-"));
    assert.strictEqual(recordedPanels().length, 1);
  });

  // preview.theme が auto のときは設定ファイルの colorScheme を指定し、文書の page のマーカーはどの設定より優先する
  test("test_normal_when_color_scheme", async () => {
    // 準備
    await writeFixture("mdmark.config.yaml", "colorScheme: light\n");
    await writeFixture("a.md", "# A\n\n段落\n");
    await writeFixture("b.md", "<!-- page: scheme=dark -->\n\n# B\n\n段落\n");
    await setSetting("preview.theme", "auto");
    await openMarkdown("a.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    // 検証: 設定ファイルの明暗を指定する
    assert.strictEqual(renders(record).at(-1)?.config.colorScheme, "light");
    const [light] = await inspect("[data-mdmark-color-theme]");
    assert.ok(light?.className.split(" ").includes("mdmark-theme-light"));
    // 実行: preview.theme を dark にする
    await setSetting("preview.theme", "dark");
    // 検証: 設定ファイルの明暗を指定せず、包む要素を dark にする
    await waitFor(
      () =>
        renders(record).some(
          (message) =>
            message.theme === "dark" && !("colorScheme" in message.config),
        ),
      { message: "dark で colorScheme を除いた config を送っていない" },
    );
    await waitForRendered(record, renders(record).length);
    await waitFor(
      async () =>
        (await inspect("#mdmark-preview"))[0]?.className
          .split(" ")
          .includes("mdmark-theme-dark") ?? false,
      { message: "包む要素が mdmark-theme-dark を持たない" },
    );
    // 実行: b.md を開き、preview.theme を light にする
    await openMarkdown("b.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const recordB = lastPanel();
    await setSetting("preview.theme", "light");
    await waitFor(
      () =>
        renders(recordB).some(
          (message) =>
            message.theme === "light" && message.markdown.includes("# B"),
        ),
      { message: "b.md を light で描いていない" },
    );
    await waitFor(
      async () =>
        (await inspect("[data-mdmark-color-theme]"))[0]?.className
          .split(" ")
          .includes("mdmark-theme-dark") ?? false,
      { message: "b.md のマーカーの明暗で描いていない" },
    );
  });

  // Markdown からの相対パスの画像を読み込む
  test("test_normal_when_relative_image", async () => {
    // 準備
    await writeFixture("docs/images/figure.png", PNG);
    await writeFixture(
      "docs/guide.md",
      "# 見出し\n\n![図](./images/figure.png)\n",
    );
    await openMarkdown("docs/guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    // 検証
    await waitFor(
      async () => ((await inspect("img"))[0]?.naturalWidth ?? 0) > 0,
      {
        message: "画像を読み込めていない",
      },
    );
  });

  // ワークスペースの外の画像は読み込まず、他の本文は描く
  test("test_error_when_image_outside_workspace", async () => {
    // 準備: ワークスペースの 1 つ上に画像を配置する
    await writeFixture("../mdmark-outside.png", PNG);
    await writeFixture(
      "docs/guide.md",
      "# 見出し\n\n![外の画像](../../mdmark-outside.png)\n",
    );
    await openMarkdown("docs/guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    await sleep(500);
    // 検証
    const [image] = await inspect("img");
    assert.strictEqual(image?.naturalWidth, 0);
    assert.strictEqual(image?.attributes.alt, "外の画像");
    assert.ok(
      (await inspect("h1")).some((item) => item.text.includes("見出し")),
    );
  });

  // 配布物の配信元が応えないとき、オフラインの理由と「リロード」を出す
  test("test_error_when_distribution_unreachable", async () => {
    // 準備
    await writeFixture("guide.md", await guideMarkdown());
    await writeFixture("mdmark.config.yaml", "features:\n  callout: false\n");
    const markdown = await guideMarkdown();
    await stub.setMode({ tags: "ok", dist: "drop" });
    await openMarkdown("guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    // 検証
    await waitFor(() =>
      record.received.some((message) => message.type === "loadFailed"),
    );
    const failed = record.received.find(
      (message) => message.type === "loadFailed",
    );
    assert.strictEqual(
      failed?.type === "loadFailed" ? failed.reason : "",
      "offline",
    );
    await waitFor(
      async () => (await inspect(".mdmark-preview-notice")).length === 1,
    );
    const [notice] = await inspect(".mdmark-preview-notice");
    assert.ok(notice?.text.includes("jsDelivr から読み込めませんでした"));
    assert.strictEqual((await inspect('[data-action="reload"]')).length, 1);
    assert.strictEqual((await inspect(".mdmark-table")).length, 0);
    assert.deepStrictEqual(await audit(), []);
    assert.strictEqual(
      await (async () =>
        (
          await vscode.workspace.openTextDocument(
            vscode.Uri.file(join(workspaceDir(), "guide.md")),
          )
        ).getText())(),
      markdown,
    );
  });

  // 1 秒経っても描き終えないとき、読み込み中を出し、描き終えたら削除する
  test("test_normal_when_loading_shown", async () => {
    // 準備
    await writeFixture("guide.md", await guideMarkdown());
    await stub.setMode({ tags: "ok", dist: "slow" });
    await openMarkdown("guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    // 検証: 開いてから 1 秒を過ぎるまでは出さず、過ぎると出る
    const opened = Date.now();
    let shownAfter = 0;
    await waitFor(
      async () => {
        const found = await inspect(".mdmark-preview-loading").catch(() => []);
        if (found.length === 1) {
          shownAfter = Date.now() - opened;
          return true;
        }
        return false;
      },
      { message: "読み込み中が出ない" },
    );
    assert.ok(shownAfter >= 900, `読み込み中が ${shownAfter} ms で出た`);
    const [loading] = await inspect(".mdmark-preview-loading");
    assert.strictEqual(loading?.attributes.role, "status");
    assert.ok(loading?.text.includes("mdmark を読み込んでいます"));
    assert.strictEqual(
      (await inspect('.mdmark-preview-loading svg[role="img"]')).length,
      1,
    );
    // 描き終えたら消え、文書が出る
    await waitForRendered(record);
    await waitFor(
      async () => (await inspect(".mdmark-preview-loading")).length === 0,
      { message: "読み込み中が消えない" },
    );
    assert.ok((await inspect("h1")).length > 0);
  });

  // 配布物の URL が 404 のとき、指定したバージョンが無い理由と「リロード」を出す
  test("test_error_when_version_missing", async () => {
    // 準備
    await setSetting("version", "v9.9.9");
    await writeFixture("guide.md", await guideMarkdown());
    await openMarkdown("guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    // 検証
    await waitFor(() =>
      record.received.some((message) => message.type === "loadFailed"),
    );
    const failed = record.received.find(
      (message) => message.type === "loadFailed",
    );
    assert.strictEqual(
      failed?.type === "loadFailed" ? failed.reason : "",
      "versionMissing",
    );
    await waitFor(
      async () => (await inspect(".mdmark-preview-notice")).length === 1,
    );
    const [notice] = await inspect(".mdmark-preview-notice");
    assert.ok(notice?.text.includes("v9.9.9"));
    assert.strictEqual((await inspect('[data-action="reload"]')).length, 1);
  });

  // Markdown でない文書でコマンドを呼んでもパネルを開かない
  test("test_error_when_not_markdown", async () => {
    // 準備
    await writeFixture("notes.txt", "メモ\n");
    await openMarkdown("notes.txt");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    await sleep(500);
    // 検証
    assert.strictEqual(recordedPanels().length, 0);
    assert.strictEqual(await tagRequestCount(), 0);
    const manifest = vscode.extensions.getExtension(EXTENSION_ID)?.packageJSON;
    assert.ok(
      JSON.stringify(manifest.contributes.menus["editor/title"]).includes(
        "editorLangId == markdown",
      ),
    );
    assert.ok(
      JSON.stringify(manifest.contributes.keybindings).includes(
        "editorLangId == markdown",
      ),
    );
  });
  // 動画・音声のパスを、文書のフォルダかアセットのルートにあるファイルの Webview の URL に替える
  test("test_normal_when_relative_media", async () => {
    // 準備
    await writeFixture("mdmark.config.yaml", "assets:\n  root: assets\n");
    const samples = join(REPO_ROOT, "docs/mock/refs/263/assets/media");
    const mp3 = await readFile(join(samples, "voice.mp3"));
    await writeFixture("docs/media/demo.mp3", mp3);
    await writeFixture(
      "docs/media/demo.mp4",
      await readFile(join(samples, "demo.mp4")),
    );
    await writeFixture("assets/media/intro.mp3", mp3);
    await writeFixture(
      "docs/guide.md",
      [
        "# 見出し",
        "",
        "![音声](media/demo.mp3)",
        "",
        "![動画](media/demo.mp4)",
        "",
        "![導入](media/intro.mp3)",
        "",
      ].join("\n"),
    );
    await openMarkdown("docs/guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    // 検証
    const webviewUrl = (relative: string) =>
      record.panel.webview
        .asWebviewUri(vscode.Uri.file(join(workspaceDir(), relative)))
        .toString();
    const expected = {
      音声: webviewUrl("docs/media/demo.mp3"),
      動画: webviewUrl("docs/media/demo.mp4"),
      導入: webviewUrl("assets/media/intro.mp3"),
    };
    const readSources = async () =>
      Object.fromEntries(
        (await inspect("audio, video")).map((element) => [
          element.attributes["aria-label"],
          element.attributes.src,
        ]),
      );
    await waitFor(
      async () =>
        JSON.stringify(await readSources()) === JSON.stringify(expected),
    ).catch(() => undefined);
    assert.deepStrictEqual(await readSources(), expected);
    // 再生してから 1 秒後: 動画は進み、音声は読み込めている
    const played = Object.fromEntries(
      (await inspect("audio, video", true)).map((element) => [
        element.attributes["aria-label"],
        element,
      ]),
    );
    const videoTime = played.動画?.currentTime ?? 0;
    assert.ok(videoTime >= 0.5, `動画: ${videoTime}`);
    assert.strictEqual(played.音声?.readyState, 4);
    assert.strictEqual(played.導入?.readyState, 4);
    assert.strictEqual((await inspect(".mdmark-notice")).length, 0);
    const csp = /Content-Security-Policy" content="([^"]*)"/.exec(
      record.panel.webview.html,
    )?.[1];
    assert.match(csp ?? "", /(?:^|;)\s*media-src /);
  });

  // 再生できない動画・音声を通知ブロックに替え、既定のアプリで開くリンクから開く
  test("test_error_when_unsupported_media", async () => {
    // 準備
    await writeFixture("docs/media/voice.m4a", Buffer.from("m4a"));
    await writeFixture("docs/media/clip.webm", Buffer.from("webm"));
    await writeFixture(
      "docs/guide.md",
      [
        "# 見出し",
        "",
        "![声](media/voice.m4a)",
        "",
        "![動き](media/clip.webm)",
        "",
        "本文の段落。",
        "",
      ].join("\n"),
    );
    await openMarkdown("docs/guide.md");
    // 実行
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    // 検証: 2 つの要素の場所に通知ブロックを出す
    await waitFor(async () => (await inspect(".mdmark-notice")).length === 2, {
      message: "通知ブロックが 2 つにならない",
    });
    const notices = await inspect(".mdmark-notice");
    assert.ok(
      notices.some((notice) =>
        notice.text.includes("この音声をプレビューで再生できません"),
      ),
    );
    assert.ok(
      notices.some((notice) =>
        notice.text.includes("この動画をプレビューで再生できません"),
      ),
    );
    const links = await inspect('a[data-action="openAsset"]');
    assert.deepStrictEqual(
      links.map((link) => [link.text, link.attributes["data-path"]]),
      [
        ["既定のアプリで開く", "media/voice.m4a"],
        ["既定のアプリで開く", "media/clip.webm"],
      ],
    );
    assert.strictEqual((await inspect("audio, video")).length, 0);
    assert.ok(
      (await inspect("p")).some((item) => item.text === "本文の段落。"),
    );
    // 実行: 音声の「既定のアプリで開く」を押す
    clickInPreview(record, 'a[data-path="media/voice.m4a"]');
    // 検証
    await waitFor(() => openedUrls.length === 1, {
      message: "openExternal が呼ばれない",
    });
    assert.deepStrictEqual(openedUrls, [
      vscode.Uri.file(join(workspaceDir(), "docs/media/voice.m4a")).toString(),
    ]);
  });
});
