import { expect, test } from "vitest";
import { DEFAULT_FEATURES } from "../../../../src/config.ts";
import { buildDictionary } from "../../../../src/knowledge/dictionary.ts";
import type { MdmarkIndex } from "../../../../src/knowledge/index-shape.ts";
import { parseDocument } from "../../../../src/knowledge/references.ts";
import { glossaryDocument } from "../../helpers/index-fixtures.ts";

/** 本文の取り出しの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadMatches = () => import("../../../../src/knowledge/matches.ts");

/** 用語 `ワークスペース`（別名 `WS`）と、別名 `公開関数` の文書 `api` を持つ索引 */
const MATCH_INDEX: MdmarkIndex = {
  schema: 1,
  docs: [
    {
      id: "api",
      path: "api.md",
      title: "API",
      description: "公開関数の一覧",
      aliases: ["公開関数"],
    },
    { id: "guide", path: "使い方/guide.md", title: "使い方" },
  ],
  terms: [
    {
      id: "ws",
      term: "ワークスペース",
      aliases: ["WS"],
      meaning: "話し合いの記録を置くフォルダ",
    },
  ],
};

/** 用語 `ワークスペース` の参照先 */
const WS_TARGET = {
  kind: "term",
  id: "ws",
  title: "ワークスペース",
  description: "話し合いの記録を置くフォルダ",
};

/** 文書 `api` の参照先 */
const API_TARGET = {
  kind: "doc",
  id: "api",
  title: "API",
  description: "公開関数の一覧",
};

/** JSON の `\u` の 4 桁のエスケープ（`ア`）。ソースに書くと整形で文字に戻るため、組み立てる */
const UNICODE_ESCAPE = ["\\", "u30a2"].join("");

/** 箱の `name` に `{{語}}` を書いた、フロー図の定義の JSON */
function flowDefinition(name: string): string[] {
  return [
    "{",
    '  "title": "受け取り",',
    '  "scope": "範囲",',
    '  "updated": "2026-10-23",',
    '  "width": 520,',
    '  "height": 160,',
    '  "nodes": [',
    `    { "id": "recv", "kind": "script", "x": 20, "y": 48, "w": 140, "h": 64, "name": "${name}", "sub": "" }`,
    "  ],",
    '  "wires": []',
    "}",
  ];
}

/** 一致の行・始まり・終わりで本文を切り出した文字 */
function cut(
  body: string,
  match: { line: number; start: number; end: number },
): string {
  return (body.split("\n")[match.line - 1] ?? "").slice(match.start, match.end);
}

/** 本文の頭からの位置を、1 から数える行に直す */
function lineOf(body: string, offset: number): number {
  return body.slice(0, offset).split("\n").length;
}

/** 本文を読んだトークンと、文書 `guide` の辞書 */
function prepare(body: string, index: MdmarkIndex = MATCH_INDEX) {
  const { tokens, features } = parseDocument({
    body,
    docId: "guide",
    defaults: DEFAULT_FEATURES,
  });
  const dictionary = buildDictionary({
    index,
    docId: "guide",
    ownGlossary: [],
    features,
  });
  return { tokens, dictionary };
}

// 本文に出たやめた言い方を一致にも参照先にも入れない（正常系）
test("test_collect_matches_ignores_avoided_terms", async () => {
  // 準備
  const { collectMatches } = await loadMatches();
  const index: MdmarkIndex = {
    schema: 1,
    docs: [{ id: "guide", path: "使い方/guide.md", title: "使い方" }],
    terms: [
      {
        id: "ws",
        term: "ワークスペース",
        meaning: "話し合いの記録を置くフォルダ",
        avoid: ["作業場"],
      },
    ],
  };
  const documents = {
    "使い方/guide.md": "# 使い方\n\nワークスペースと作業場を使う。",
  };
  // 実行
  const result = collectMatches({ index, documents });
  // 検証
  expect((result.byDocument.guide ?? []).map((match) => match.text)).toEqual([
    "ワークスペース",
  ]);
  expect(result.targets.map((target) => target.id)).toEqual(["ws"]);
});

// 索引の用語・別名と文書の別名の一致を、参照先と位置つきで返す（正常系）
test("test_collect_matches", async () => {
  // 準備
  const { collectMatches } = await loadMatches();
  const index = structuredClone(MATCH_INDEX);
  const documents = { "使い方/guide.md": "# 使い方\n\nWS で公開関数を呼ぶ。" };
  const documentsBefore = structuredClone(documents);
  // 実行
  const matches = collectMatches({ index, documents });
  // 検証
  expect(matches).toEqual({
    byDocument: {
      guide: [
        {
          ...WS_TARGET,
          text: "WS",
          line: 3,
          start: 0,
          end: 2,
        },
        {
          ...API_TARGET,
          text: "公開関数",
          line: 3,
          start: 4,
          end: 8,
        },
      ],
    },
    targets: [WS_TARGET, API_TARGET],
  });
  expect(index).toEqual(MATCH_INDEX);
  expect(documents).toEqual(documentsBefore);
});

// 同じ節に同じ用語が何度出ても全ての出現を並べ、targets には 1 回だけ入れる（正常系）
test("test_collect_matches_lists_every_occurrence", async () => {
  // 準備
  const { collectMatches } = await loadMatches();
  const body =
    "# 使い方\n\nワークスペースを開き、WS を確かめ、ワークスペースを閉じる。\n";
  // 実行
  const matches = collectMatches({
    index: MATCH_INDEX,
    documents: { "使い方/guide.md": body },
  });
  // 検証
  const guide = matches.byDocument.guide ?? [];
  expect(
    guide.map((match) => [match.text, match.line, match.start, match.end]),
  ).toEqual([
    ["ワークスペース", 3, 0, 7],
    ["WS", 3, 11, 13],
    ["ワークスペース", 3, 19, 26],
  ]);
  expect(guide.map((match) => cut(body, match))).toEqual([
    "ワークスペース",
    "WS",
    "ワークスペース",
  ]);
  expect(matches.targets).toEqual([WS_TARGET]);
});

// コード・リンクの文字・見出し・用語集の表の中の語と、文書自身の別名を一致にしない（正常系）
test("test_collect_matches_ignores_code_links_and_headings", async () => {
  // 準備
  const { collectMatches } = await loadMatches();
  const guide = [
    "# ワークスペース",
    "",
    "`ワークスペース` と [ワークスペース](./ws.md)",
    "",
    glossaryDocument([["印", "ワークスペースに付ける指定"]]),
  ].join("\n");
  const api = "# API\n\n自身の別名 公開関数 を書く。\n";
  // 実行
  const matches = collectMatches({
    index: MATCH_INDEX,
    documents: { "使い方/guide.md": guide, "api.md": api },
  });
  // 検証
  expect(matches.byDocument).toEqual({ guide: [], api: [] });
  expect(matches.targets).toEqual([]);
});

// ほかの文書の用語集の表の用語を glossary の参照先として返す（正常系）
test("test_collect_matches_when_glossary_table", async () => {
  // 準備
  const { collectMatches } = await loadMatches();
  const index: MdmarkIndex = {
    schema: 1,
    docs: [
      { id: "glossary", path: "用語集.md", title: "用語集" },
      { id: "guide", path: "使い方/guide.md", title: "使い方" },
    ],
    terms: [],
  };
  const documents = {
    "用語集.md": glossaryDocument([["印", "HTML コメントで書く指定"]]),
    "使い方/guide.md": "# 使い方\n\n印を付け、印刷する。\n",
  };
  const target = {
    kind: "glossary",
    id: "glossary:glossary:印",
    title: "印",
    description: "HTML コメントで書く指定",
  };
  // 実行
  const matches = collectMatches({ index, documents });
  // 検証
  // `印刷` は 1 語なので、その中の `印` は一致にならない
  expect(matches.byDocument.guide).toEqual([
    { ...target, text: "印", line: 3, start: 0, end: 1 },
  ]);
  // 用語集の表の中の `印` は、表を持つ文書の一致にならない
  expect(matches.byDocument.glossary).toEqual([]);
  expect(matches.targets).toEqual([target]);
});

// 文書の印でオフにした機能の種類の一致を返さない（正常系）
test("test_collect_matches_when_disabled", async () => {
  // 準備
  const { collectMatches } = await loadMatches();
  const index: MdmarkIndex = {
    ...MATCH_INDEX,
    docs: [...MATCH_INDEX.docs, { id: "memo", path: "memo.md", title: "メモ" }],
  };
  const paragraph = "ワークスペースと公開関数を使う。";
  const guide = `<!-- features: -glossary -->\n\n${paragraph}\n`;
  const memo = `<!-- features: -glossary -backlinks -->\n\n${paragraph}\n`;
  // 実行
  const matches = collectMatches({
    index,
    documents: { "使い方/guide.md": guide, "memo.md": memo },
  });
  // 検証
  // glossary がオフの guide は、用語を返さず文書の別名だけを返す
  expect(matches.byDocument.guide).toEqual([
    { ...API_TARGET, text: "公開関数", line: 3, start: 8, end: 12 },
  ]);
  // 両方がオフの memo は何も返さない
  expect(matches.byDocument.memo).toEqual([]);
  expect(matches.targets).toEqual([API_TARGET]);
});

// Schema に合わない用語・文書を除いて照合し、例外を投げない（正常系）
test("test_collect_matches_when_invalid_index", async () => {
  // 準備
  const { collectMatches } = await loadMatches();
  // `meaning` を持たない用語 `印` と、`path` を持たない文書 `broken` を足した索引
  const index = {
    schema: 1,
    docs: [
      ...MATCH_INDEX.docs,
      { id: "broken", title: "壊れた", aliases: ["壊れた文書"] },
    ],
    terms: [...(MATCH_INDEX.terms ?? []), { id: "mark", term: "印" }],
  } as unknown as MdmarkIndex;
  const documents = {
    "使い方/guide.md": "# 使い方\n\nWS・印・壊れた文書を並べる。\n",
  };
  // 実行
  let matches: Awaited<ReturnType<typeof collectMatches>> | undefined;
  expect(() => {
    matches = collectMatches({ index, documents });
  }).not.toThrow();
  // 検証
  expect(matches?.byDocument.guide?.map((match) => match.text)).toEqual(["WS"]);
  expect(matches?.targets.map((target) => target.id)).toEqual(["ws"]);
});

// 図の部品の {{語}} は、語が文書の別名でもあるときも用語の参照先だけを返す（正常系）
test("test_collect_matches_when_diagram_term_is_alias", async () => {
  // 準備
  const { collectMatches } = await loadMatches();
  // 用語 `公開関数`（`fn`）と、別名 `公開関数` を持つ文書 `api`
  const index: MdmarkIndex = {
    schema: 1,
    docs: [
      {
        id: "api",
        path: "api.md",
        title: "API",
        description: "公開関数の一覧",
        aliases: ["公開関数"],
      },
      { id: "guide", path: "使い方/guide.md", title: "使い方" },
    ],
    terms: [{ id: "fn", term: "公開関数", meaning: "配布物から呼べる関数" }],
  };
  const body = [
    "<!-- flow -->",
    "",
    "```json",
    ...flowDefinition("{{公開関数}}"),
    "```",
    "",
    "<!-- /flow -->",
    "",
  ].join("\n");
  // 実行
  const matches = collectMatches({
    index,
    documents: { "使い方/guide.md": body },
  });
  // 検証
  // 箱の `{{公開関数}}` は用語の 1 件だけで、文書 `api` は返らない
  const guide = matches.byDocument.guide ?? [];
  expect(
    guide.map((match) => [match.kind, match.id, cut(body, match)]),
  ).toEqual([["term", "fn", "公開関数"]]);
  expect(matches.targets).toEqual([
    {
      kind: "term",
      id: "fn",
      title: "公開関数",
      description: "配布物から呼べる関数",
    },
  ]);
});

// 埋め込んだ HTML の文字の用語の位置だけを返し、属性の値・落ちる要素・照合しない要素が直接持つ同じ綴りは返さない（正常系）
test("test_embedded_html_matches", async () => {
  // 準備
  const { embeddedHtmlMatches } = await loadMatches();
  const body = [
    "<!-- html -->",
    "",
    "```html",
    "<p>&amp;&lt;b&gt; の後ろのワークスペース</p>",
    '<span title="ワークスペース">ワークスペース</span>',
    "<script>ワークスペース</script>WS",
    "<code>ワークスペース</code> とワークスペース",
    '<a href="#">ワークスペース</a>',
    '<a href="#"><span>ワークスペース</span></a>',
    "```",
    "",
    "<!-- /html -->",
    "",
  ].join("\n");
  const { tokens, dictionary } = prepare(body);
  // 実行
  const matches = embeddedHtmlMatches({ body, tokens, dictionary });
  // 検証
  // p の文字・span の要素の文字・script の後ろの WS・code の後ろの文字・a の中の span の文字
  expect(matches.map((match) => match.word)).toEqual([
    "ワークスペース",
    "ワークスペース",
    "WS",
    "ワークスペース",
    "ワークスペース",
  ]);
  expect(matches.map((match) => lineOf(body, match.offset))).toEqual([
    4, 5, 6, 7, 9,
  ]);
  // 本文の位置で切り出した文字が、一致した文字と同じ
  for (const match of matches) {
    expect(body.slice(match.offset, match.end)).toBe(match.word);
  }
  // 5 行目は属性の値でなく、要素の文字を指す
  expect(body[(matches[1]?.offset ?? 0) - 1]).toBe(">");
});

// 定義の {{語}} の用語の位置を返し、用語でない語は返さない（正常系）
test("test_diagram_term_matches", async () => {
  // 準備
  const { diagramTermMatches } = await loadMatches();
  const body = [
    "<!-- flow -->",
    "",
    "```json",
    // JSON のエスケープ（\" と \u の 4 桁）の後ろの語
    ...flowDefinition(
      `\\"鍵\\" ${UNICODE_ESCAPE} {{ワークスペース}} と {{公開関数}}`,
    ),
    "```",
    "",
    "<!-- /flow -->",
    "",
    "<!-- html -->",
    "",
    "```html",
    "<mdmark-flow>",
    ...flowDefinition("{{ワークスペース}}"),
    "</mdmark-flow>",
    "```",
    "",
    "<!-- /html -->",
    "",
  ].join("\n");
  const { tokens, dictionary } = prepare(body);
  // 実行
  const matches = diagramTermMatches({ body, tokens, dictionary, html: true });
  // 検証
  // `{{公開関数}}` は文書の別名で用語ではないため返らない
  expect(matches.map((match) => match.word)).toEqual([
    "ワークスペース",
    "ワークスペース",
  ]);
  for (const match of matches) {
    expect(body.slice(match.offset, match.end)).toBe("ワークスペース");
  }
  // 1 つ目は flow の範囲の定義、2 つ目は埋め込んだ HTML の中の定義
  expect(body.slice(0, matches[1]?.offset ?? 0)).toContain("<!-- html -->");
  expect(body.slice(0, matches[0]?.offset ?? 0)).not.toContain("<!-- html -->");
});
