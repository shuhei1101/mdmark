import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { LoadedConfig } from "../../../../src/cli/config.ts";
import {
  type PayloadView,
  useTempDirs,
  writeFiles,
} from "../../helpers/cli.ts";

/** mdmark の痕跡を隠す処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTraces = () => import("../../../../src/cli/traces.ts");

const createTempDir = useTempDirs();

// 大文字・小文字の構成を保って置き換える（正常系）
test("test_hide_names", async () => {
  // 準備
  const { hideNames } = await loadTraces();
  // 実行
  const hidden = hideNames(
    ".mdmark-table{} __mdmarkHtmlScript MDMARK Mdmark @layer mdmark",
  );
  // 検証
  expect(hidden).toBe(".zq-table{} __zqHtmlScript ZQ Zq @layer zq");
});

// 部品の要素名・CSS 変数・class の値だけを置き換える（正常系）
test("test_hide_markdown", async () => {
  // 準備
  const { hideMarkdown } = await loadTraces();
  const markdown =
    'mdmark は描く。<mdmark-chart>{}</mdmark-chart> <p class="mdmark-align-center">x</p> [紹介](./mdmark-intro.md) var(--mdmark-color-fg)';
  // 実行
  const hidden = hideMarkdown({ markdown, markNames: new Set<string>() });
  // 検証
  expect(hidden).toBe(
    'mdmark は描く。<zq-chart>{}</zq-chart> <p class="zq-align-center">x</p> [紹介](./mdmark-intro.md) var(--zq-color-fg)',
  );
});

// マーカーの名前でないコメントだけを削除する（正常系）
test("test_hide_markdown_when_comments", async () => {
  // 準備
  const { hideMarkdown } = await loadTraces();
  const markdown = [
    "<!-- todo -->",
    "",
    "<!-- 補足: あとで -->",
    "",
    "<!-- table: data -->",
    "",
    "| a |",
    "| --- |",
    "| 1 |",
    "",
    "<!-- /table -->",
    "",
    "<!-- greet -->",
    "",
    "```md",
    "<!-- todo -->",
    "```",
    "",
  ].join("\n");
  // 実行
  const hidden = hideMarkdown({
    markdown,
    markNames: new Set(["table", "greet"]),
  });
  // 検証
  expect(hidden).not.toContain("補足: あとで");
  expect(hidden.match(/<!-- todo -->/g)).toHaveLength(1);
  expect(hidden).toContain("```md\n<!-- todo -->\n```");
  expect(hidden).toContain("<!-- table: data -->");
  expect(hidden).toContain("<!-- /table -->");
  expect(hidden).toContain("<!-- greet -->");
});

// 記法・外部ライブラリ・拡張・check.ignore の名前を集める（正常系）
test("test_collect_mark_names", async () => {
  // 準備
  const { collectMarkNames } = await loadTraces();
  const dir = await createTempDir();
  await writeFiles(dir, {
    "extensions/example.js": await readFile(
      join(import.meta.dirname, "../../../../templates/extensions/example.js"),
      "utf8",
    ),
  });
  const loaded: LoadedConfig = {
    path: join(dir, "mdmark.config.yaml"),
    dir,
    config: {
      libraries: { "test-lib": "./vendor/test-lib.js" },
      extensions: ["extensions/example.js"],
      check: { ignore: ["memo"] },
    },
  };
  // 実行
  const names = await collectMarkNames(loaded);
  // 検証
  for (const name of [
    "table",
    "html",
    "features",
    "test-lib",
    "greet",
    "memo",
  ]) {
    expect(names.has(name)).toBe(true);
  }
});

// 設定の値だけを置き換え、利用者が記載した値を残す（正常系）
test("test_hide_payload", async () => {
  // 準備
  const { hidePayload } = await loadTraces();
  const index = {
    docs: [{ id: "intro", path: "mdmark-intro.md", title: "mdmark の紹介" }],
    terms: [{ term: "mdmark", description: "文書を描くライブラリ" }],
  } as unknown as PayloadView["index"];
  const payload: PayloadView = {
    kind: "document",
    config: { mermaid: { theme: "mdmark" } },
    index,
    docs: [
      {
        path: "mdmark-intro.md",
        title: "mdmark の紹介",
        markdown: "mdmark は描く。\n",
      },
    ],
    entry: "mdmark-intro.md",
  };
  // 実行
  const hidden = hidePayload(payload);
  // 検証
  expect(
    (hidden.config as { mermaid?: { theme?: string } }).mermaid?.theme,
  ).toBe("zq");
  expect(hidden.docs[0]?.title).toBe("mdmark の紹介");
  expect(hidden.docs[0]?.path).toBe("mdmark-intro.md");
  expect(hidden.index).toEqual(index);
});

// バージョンを削除し、名前を置き換える（正常系）
test("test_hide_css", async () => {
  // 準備
  const { hideCss } = await loadTraces();
  const css =
    ':root{--mdmark-version:"v0.12.0"}\n@layer mdmark{.mdmark{--mdmark-radius:3px}}';
  // 実行
  const hidden = hideCss(css);
  // 検証
  expect(hidden).not.toContain("v0.12.0");
  expect(hidden).not.toMatch(/mdmark/i);
  expect(hidden).toContain("@layer zq{.zq{--zq-radius:3px}}");
});

// 鍵を残して名前を置き換える（正常系）
test("test_hide_script", async () => {
  // 準備
  const { hideScript } = await loadTraces();
  // 実行
  const hidden = hideScript({
    code: 'window.__mdmarkHtmlScript=new Map([["@@html-script-key-0@@",f]])',
    keys: ["window.__mdmarkOpened = true"],
  });
  // 検証
  expect(hidden).toBe(
    'window.__zqHtmlScript=new Map([["window.__mdmarkOpened = true",f]])',
  );
});

// ライセンスの注釈をそのまま残す（正常系）
test("test_hide_script_when_license", async () => {
  // 準備
  const { hideScript } = await loadTraces();
  const extensionLicense = "/*! greet-ext (c) user - MIT */";
  const bundledLicense = [
    "/*! Bundled license information:",
    "",
    "is-plain-object/dist/is-plain-object.js:",
    "  (*!",
    "   * is-plain-object <https://github.com/jonschlinkert/is-plain-object>",
    "   *",
    "   * Copyright (c) 2014-2017, Jon Schlinkert.",
    "   * Released under the MIT License.",
    "   *)",
    "*/",
  ].join("\n");
  const code = `${extensionLicense}\nconst a=1;\n${bundledLicense}\n`;
  // 実行
  const hidden = hideScript({ code, keys: [] });
  // 検証
  expect(hidden).toContain(extensionLicense);
  expect(hidden).toContain(bundledLicense);
});
