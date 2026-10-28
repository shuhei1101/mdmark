import { expect, test } from "vitest";
import type { MdmarkAlias } from "../../../../src/knowledge/aliases.ts";
import { findTag } from "../../helpers/html.ts";

/** 用語のツールチップの部品を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTermTip = () => import("../../../../src/parts/term-tip.ts");

/** 部品設計『用語のツールチップ』の `DocsOnly` の関連文書 */
const API_DOC = {
  title: "API",
  href: "../api.md",
  description: "mount・render などの公開関数と引数の一覧",
};

// 部品設計の状態ごとに HTML を返す（正常系）
test("test_render_term_tip", async () => {
  // 準備
  const { renderTermTip } = await loadTermTip();
  // 実行
  const termOnly = renderTermTip({
    text: "ワークスペース",
    id: "tip-term",
    meaning: "話し合いの記録を置くフォルダ",
  });
  const docsOnly = renderTermTip({
    text: "公開関数",
    id: "tip-docs",
    docs: [API_DOC],
  });
  const both = renderTermTip({
    text: "索引",
    id: "tip-both",
    meaning: "文書と用語を並べた YAML のファイル",
    docs: [API_DOC],
  });
  // 検証
  // 意味だけ: role="tooltip" で、見出し「用語」だけを持つ
  expect(findTag(termOnly, 'id="tip-term"')).toContain('role="tooltip"');
  expect(termOnly).toContain("話し合いの記録を置くフォルダ");
  expect(termOnly).toContain(">用語<");
  expect(termOnly).not.toContain("関連文書");
  // 関連文書だけ: role="group" で、見出し「関連文書」とリンクを持ち、「用語」の見出しを持たない
  expect(findTag(docsOnly, 'id="tip-docs"')).toContain('role="group"');
  expect(docsOnly).toContain("関連文書");
  expect(docsOnly).not.toContain(">用語<");
  expect(docsOnly).toContain('href="../api.md"');
  expect(docsOnly).toContain("mount・render などの公開関数と引数の一覧");
  // 両方: role="group" で、見出し「用語」の次に「関連文書」が並ぶ
  expect(findTag(both, 'id="tip-both"')).toContain('role="group"');
  expect(both.indexOf(">用語<")).toBeGreaterThan(-1);
  expect(both.indexOf(">用語<")).toBeLessThan(both.indexOf(">関連文書<"));
  expect(both).toContain("文書と用語を並べた YAML のファイル");
  // どの状態も hidden を持たない（開閉は CSS と attachTermTips が付ける class が決める）
  for (const html of [termOnly, docsOnly, both]) {
    expect(html).not.toMatch(/\shidden(?=[\s=>])/);
  }
});

// 意味と題をエスケープする（正常系）
test("test_render_term_tip_escapes", async () => {
  // 準備
  const { renderTermTip } = await loadTermTip();
  // 実行
  const html = renderTermTip({
    text: "語",
    id: "tip-escape",
    meaning: "<script>alert(1)</script>",
    docs: [{ title: "<b>題</b>", href: "../a.md" }],
  });
  // 検証
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;b&gt;題&lt;/b&gt;");
});

// `replacement` を渡すと、やめた言い方のマーカーと代わりの用語のツールチップを返す（正常系）
test("test_render_term_tip_avoided", async () => {
  // 準備
  const { renderTermTip } = await loadTermTip();
  // 実行
  // 部品設計の `Avoided` の引数に、使われないはずの `meaning`・`docs` も渡す
  const html = renderTermTip({
    text: "作業場",
    id: "tip-avoided",
    meaning: "渡しても出ない意味",
    docs: [API_DOC],
    replacement: {
      term: "ワークスペース",
      meaning: "話し合いの記録を置くフォルダ",
    },
  });
  const escaped = renderTermTip({
    text: "作業場",
    id: "tip-avoided-escape",
    replacement: {
      term: "<script>語</script>",
      meaning: "<script>意味</script>",
    },
  });
  // 検証
  const word = findTag(html, "mdmark-term-avoided");
  expect(word).toContain('class="mdmark-term mdmark-term-avoided"');
  expect(word).toContain('aria-describedby="tip-avoided"');
  expect(findTag(html, 'id="tip-avoided"')).toContain('role="tooltip"');
  // 見出しは「代わりの用語」だけで、代わりの用語の語と意味が出る
  expect(html).toContain(">代わりの用語<");
  expect(html).not.toContain(">用語<");
  expect(html).not.toContain("関連文書");
  expect(findTag(html, "mdmark-term-tip-replacement")).toBeDefined();
  expect(html).toContain("ワークスペース");
  expect(html).toContain("話し合いの記録を置くフォルダ");
  // 渡した `meaning`・`docs` は出ない
  expect(html).not.toContain("渡しても出ない意味");
  expect(html).not.toContain("../api.md");
  // 代わりの用語の語と意味をエスケープする
  expect(escaped).toContain("&lt;script&gt;語&lt;/script&gt;");
  expect(escaped).toContain("&lt;script&gt;意味&lt;/script&gt;");
  expect(escaped).not.toContain("<script>");
});

// `below` を渡すと、語を包む要素に is-below を付ける（正常系）
test("test_render_term_tip_below", async () => {
  // 準備
  const { renderTermTip } = await loadTermTip();
  // 実行
  // 部品設計の `Below` と `TermOnly` の引数
  const below = renderTermTip({
    text: "ワークスペース",
    id: "tip-below",
    meaning: "話し合いの記録を置くフォルダ",
    below: true,
  });
  const termOnly = renderTermTip({
    text: "ワークスペース",
    id: "tip-term",
    meaning: "話し合いの記録を置くフォルダ",
  });
  // 検証
  expect(findTag(below, "mdmark-term-wrap")).toContain("is-below");
  expect(findTag(termOnly, "mdmark-term-wrap")).not.toContain("is-below");
});

/** 部品設計『用語のツールチップ』の `AliasCommand` の `alias` */
const COMMAND_ALIAS: MdmarkAlias = {
  alias_type: "command",
  id: "unit-test",
  name: "単体テスト",
  aliases: [],
  description: "ライブラリ本体の単体テストを流す",
  command: "npm run test:unit",
  cwd: "リポジトリの直下",
};

/** 部品設計『用語のツールチップ』の `AliasUrl` の `alias` */
const URL_ALIAS: MdmarkAlias = {
  alias_type: "url",
  id: "issues",
  name: "課題の一覧",
  aliases: [],
  description: "Issue を並べたページ",
  url: "https://github.com/shuhei1101/mdmark/issues",
};

/** HTML の見出し（`mdmark-term-tip-heading`）の文字を、現れた順に返す */
function headings(html: string): string[] {
  return [...html.matchAll(/class="mdmark-term-tip-heading">([^<]*)</g)].map(
    (found) => found[1] ?? "",
  );
}

// エイリアスの種類ごとの区分と role を返す（正常系）
test("test_render_term_tip_alias", async () => {
  // 準備
  const { renderTermTip } = await loadTermTip();
  const cases: Array<{
    id: string;
    text: string;
    heading: string;
    role: string;
    alias: MdmarkAlias;
  }> = [
    {
      id: "tip-alias-term",
      text: "査読",
      heading: "用語",
      role: "tooltip",
      alias: {
        alias_type: "term",
        id: "review",
        name: "レビュー",
        aliases: ["査読"],
        description: "変更を別の人が確かめること",
      },
    },
    {
      id: "tip-alias-doc",
      text: "設計書",
      heading: "文書",
      role: "tooltip",
      alias: {
        alias_type: "doc",
        id: "design-doc",
        name: "設計書",
        aliases: [],
        description: "仕様を記載した文書",
      },
    },
    {
      id: "tip-alias-command",
      text: "単体テスト",
      heading: "コマンド",
      role: "group",
      alias: COMMAND_ALIAS,
    },
    {
      id: "tip-alias-url",
      text: "課題の一覧",
      heading: "URL",
      role: "group",
      alias: URL_ALIAS,
    },
    {
      id: "tip-alias-skill",
      text: "記録の取り込み",
      heading: "スキル",
      role: "tooltip",
      alias: {
        alias_type: "skill",
        id: "session",
        name: "記録の取り込み",
        aliases: [],
        skill: "mindstella:session",
      },
    },
    {
      id: "tip-alias-tool",
      text: "点検のツール",
      heading: "ツール",
      role: "tooltip",
      alias: {
        alias_type: "tool",
        id: "check-tool",
        name: "点検のツール",
        aliases: [],
        description: "設定と索引のずれを返す",
        tool: "check",
      },
    },
    {
      id: "tip-alias-path",
      text: "設定ファイル",
      heading: "パス",
      role: "tooltip",
      alias: {
        alias_type: "path",
        id: "config-file",
        name: "設定ファイル",
        aliases: [],
        description: "機能のオン・オフと読む文書を記載する",
        path: "mdmark.config.yaml",
      },
    },
  ];
  // 実行
  const results = cases.map((item) => ({
    item,
    html: renderTermTip({
      text: item.text,
      id: item.id,
      meaning: "渡した意味",
      docs: [API_DOC],
      alias: item.alias,
    }),
  }));
  // 検証
  for (const { item, html } of results) {
    // 区分は種類の見出し 1 つだけで、渡した meaning と docs は出ない
    expect(headings(html)).toEqual([item.heading]);
    expect(html).not.toContain("渡した意味");
    expect(html).not.toContain("../api.md");
    expect(findTag(html, `id="${item.id}"`)).toContain(`role="${item.role}"`);
  }
  const command = results.find(({ item }) => item.id === "tip-alias-command");
  expect(command?.html).toMatch(/<code[^>]*>npm run test:unit<\/code>/);
  expect(command?.html).toMatch(
    /<button[^>]*data-state="idle"[^>]*>[\s\S]*?コピー[\s\S]*?<\/button>/,
  );
  expect(command?.html).toContain("実行場所");
  expect(command?.html).toMatch(/role="status"[^>]*><\/span>/);
  const skill = results.find(({ item }) => item.id === "tip-alias-skill");
  expect(skill?.html).not.toContain("mdmark-term-tip-meaning");
});

// copy の状態をボタンと読み上げの要素に出す（正常系）
test("test_render_term_tip_alias_copy", async () => {
  // 準備
  const { renderTermTip } = await loadTermTip();
  // 実行
  const copied = renderTermTip({
    text: "単体テスト",
    id: "tip-copied",
    alias: COMMAND_ALIAS,
    copy: "copied",
  });
  const failed = renderTermTip({
    text: "単体テスト",
    id: "tip-failed",
    alias: COMMAND_ALIAS,
    copy: "failed",
  });
  // 検証
  expect(copied).toMatch(/<button[^>]*data-state="copied"/);
  expect(copied).toContain("コピーしました");
  expect(copied).toMatch(/role="status"[^>]*>コマンドをコピーしました</);
  expect(failed).toMatch(/<button[^>]*data-state="failed"/);
  expect(failed).toContain("コピーできませんでした");
  expect(failed).toMatch(
    /role="status"[^>]*>コマンドをコピーできませんでした</,
  );
});

// http・https でない URL をリンクにしない（正常系）
test("test_render_term_tip_alias_url_not_http", async () => {
  // 準備
  const { renderTermTip } = await loadTermTip();
  // 実行
  const html = renderTermTip({
    text: "危ないリンク",
    id: "tip-not-http",
    alias: {
      alias_type: "url",
      id: "bad-link",
      name: "危ないリンク",
      aliases: [],
      url: "javascript:alert(1)",
    },
  });
  // 検証
  expect(html).not.toMatch(/<a[\s>]/);
  expect(html).toMatch(
    /<span class="mdmark-term-tip-link"[^>]*>javascript:alert\(1\)<\/span>/,
  );
  expect(findTag(html, 'id="tip-not-http"')).toContain('role="tooltip"');
});

// エイリアスの値をエスケープする（正常系）
test("test_render_term_tip_alias_escapes", async () => {
  // 準備
  const { renderTermTip } = await loadTermTip();
  const danger = '<script>"';
  // 実行
  const command = renderTermTip({
    text: "語",
    id: "tip-escape-command",
    alias: {
      alias_type: "command",
      id: "danger",
      name: danger,
      aliases: [],
      description: danger,
      command: danger,
      cwd: danger,
    },
  });
  const url = renderTermTip({
    text: "語",
    id: "tip-escape-url",
    alias: {
      alias_type: "url",
      id: "danger-url",
      name: "危険な URL",
      aliases: [],
      url: 'https://example.com/"><script>',
    },
  });
  // 検証
  for (const html of [command, url]) {
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  }
  expect(findTag(url, "href=")).toContain("&quot;");
});

// replacement の meaning が無ければ代わりの用語の語だけを出す（正常系）
test("test_render_term_tip_avoided_without_meaning", async () => {
  // 準備
  const { renderTermTip } = await loadTermTip();
  // 実行
  const html = renderTermTip({
    text: "作業場",
    id: "tip-alias-avoid",
    replacement: { term: "ワークスペース" },
  });
  // 検証
  expect(headings(html)).toEqual(["代わりの用語"]);
  expect(html).toContain("ワークスペース");
  expect(html).not.toContain("mdmark-term-tip-meaning");
});

// 状態ごとのアイコンと文言を返す（正常系）
test("test_render_term_tip_copy", async () => {
  // 準備
  const { renderTermTipCopy } = await loadTermTip();
  // 実行
  const states = (["idle", "copied", "failed"] as const).map((state) =>
    renderTermTipCopy(state),
  );
  // 検証
  const labels = ["コピー", "コピーしました", "コピーできませんでした"];
  states.forEach((html, position) => {
    expect(html).toContain(labels[position] ?? "");
    expect(html).toContain("<svg");
  });
});
