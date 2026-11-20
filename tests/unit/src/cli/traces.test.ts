import { expect, test } from "vitest";
import type { PayloadView } from "../../helpers/cli.ts";

/** mdmark の痕跡を隠す処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTraces = () => import("../../../../src/cli/traces.ts");

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
        rendered: {
          html: "<p>mdmark は描く。</p>",
          features: {},
          page: {},
          paramDefinitions: [],
          extensionDefinitions: [],
        },
        pureMarkdown: "mdmark は描く。\n",
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

// docs[].rendered.html に hideRenderedHtml を適用し、docs[].pureMarkdown は置き換えない（正常系）
test("test_hide_payload_with_rendered", async () => {
  // 準備
  const { hidePayload } = await loadTraces();
  const payload: PayloadView = {
    kind: "document",
    config: {},
    docs: [
      {
        path: "a.md",
        title: "A",
        rendered: {
          html: '<div class="mdmark-table" data-mdmark-kind="data"><p>mdmark は描く。</p></div>',
          features: {},
          page: {},
          paramDefinitions: [],
          extensionDefinitions: [],
        },
        pureMarkdown: "mdmark は描く。\n",
      },
    ],
    entry: "a.md",
  };
  // 実行
  const hidden = hidePayload(payload);
  // 検証
  expect(hidden.docs[0]?.rendered.html).toBe(
    '<div class="zq-table" data-zq-kind="data"><p>mdmark は描く。</p></div>',
  );
  expect(hidden.docs[0]?.pureMarkdown).toBe("mdmark は描く。\n");
});

// タグと属性の mdmark を置き換え、本文の文字とリンク先は残し、HTML のコメントを削除する（正常系）
test("test_hide_rendered_html", async () => {
  // 準備
  const { hideRenderedHtml } = await loadTraces();
  const html =
    '<mdmark-chart class="mdmark-x" data-mdmark-mermaid style="color:var(--mdmark-fg)"><a href="mdmark-intro.md">mdmark</a></mdmark-chart><!-- c --><img src="mdmark-asset:1">';
  // 実行
  const hidden = hideRenderedHtml(html);
  // 検証
  expect(hidden).toBe(
    '<zq-chart class="zq-x" data-zq-mermaid style="color:var(--zq-fg)"><a href="mdmark-intro.md">mdmark</a></zq-chart><img src="zq-asset:1">',
  );
});

// コードの例の部品の要素名を置き換え、ほかの文字と範囲のスクリプトのコードは残す（正常系）
test("test_hide_rendered_html_with_code_example", async () => {
  // 準備
  const { hideRenderedHtml } = await loadTraces();
  const html =
    '<pre><code>&lt;mdmark-chart&gt;{}&lt;/mdmark-chart&gt; mdmark</code></pre><template class="mdmark-html-script" data-lang="ts">"&lt;mdmark-x&gt;"</template>';
  // 実行
  const hidden = hideRenderedHtml(html);
  // 検証
  expect(hidden).toContain(
    "<code>&lt;zq-chart&gt;{}&lt;/zq-chart&gt; mdmark</code>",
  );
  expect(hidden).toContain('data-lang="ts">"&lt;mdmark-x&gt;"</template>');
});

// 文書の中の id を指す href="#…"・aria-*・for・headers も id と同じく置き換え、指す先の id と一致させる（正常系）
test("test_hide_rendered_html_keeps_id_references", async () => {
  // 準備
  const { hideRenderedHtml } = await loadTraces();
  const html = [
    '<sup><a id="mdmark-fnref-1-0" href="#mdmark-fn-1" aria-describedby="mdmark-fn-tip-1-0 mdmark-note-1">[1]</a></sup>',
    '<span role="tooltip" id="mdmark-fn-tip-1-0">脚注</span>',
    '<label for="mdmark-input-1">a</label><td headers="mdmark-th-1">b</td>',
    '<a href="mdmark-intro.md#mdmark">外のリンク</a>',
    '<video aria-label="mdmark の紹介" controls></video>',
    '<ol><li id="mdmark-fn-1">脚注の一覧</li></ol>',
  ].join("");
  // 実行
  const hidden = hideRenderedHtml(html);
  // 検証
  const ids = new Set(
    [...hidden.matchAll(/\sid="([^"]*)"/g)].map((match) => match[1]),
  );
  const href = /href="#([^"]*)"/.exec(hidden)?.[1];
  const described = /aria-describedby="([^"]*)"/.exec(hidden)?.[1] ?? "";
  expect(ids.has(href ?? "")).toBe(true);
  expect(ids.has(described.split(" ")[0])).toBe(true);
  expect(described).toBe("zq-fn-tip-1-0 zq-note-1");
  expect(hidden).toContain('for="zq-input-1"');
  expect(hidden).toContain('headers="zq-th-1"');
  expect(hidden).toContain('href="mdmark-intro.md#mdmark"');
  expect(hidden).toContain('aria-label="mdmark の紹介"');
});

// 範囲の CSS の style 要素の中は CSS として名前を置き換え、範囲のスクリプトの template の中のコードは置き換えない（正常系）
test("test_hide_rendered_html_with_range_style", async () => {
  // 準備
  const { hideRenderedHtml } = await loadTraces();
  const html = [
    '<div class="mdmark-html" data-html-scope="0">',
    '<style class="mdmark-html-style">.mdmark-html[data-html-scope="0"] .box{color:var(--mdmark-fg)}</style>',
    '<div class="box">mdmark</div>',
    '<template class="mdmark-html-script" data-lang="ts">root.querySelector(".mdmark-x")</template>',
    "</div>",
  ].join("");
  // 実行
  const hidden = hideRenderedHtml(html);
  // 検証
  expect(hidden).toContain(
    '<style class="zq-html-style">.zq-html[data-html-scope="0"] .box{color:var(--zq-fg)}</style>',
  );
  expect(hidden).toContain('<div class="box">mdmark</div>');
  expect(hidden).toContain('root.querySelector(".mdmark-x")</template>');
});
