import { expect, test } from "vitest";
import { DEFAULT_FEATURES } from "../../../../src/config.ts";
import { parseDocument } from "../../../../src/knowledge/references.ts";
import {
  AVOID_GLOSSARY_DOCUMENT,
  AVOID_GLOSSARY_GUIDE,
  AVOIDED_GUIDE,
  AVOIDED_TERMS,
  glossaryDocument,
} from "../../helpers/index-fixtures.ts";

/** 索引の点検を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCheck = () => import("../../../../src/knowledge/check.ts");

/** 語彙とずれるタグを持つ索引（`tags[2]` が重なり、`tags[1]` の別名が `tags[0]` と重なり、`tags[4]` の振り替え先が語彙に無い） */
const TAG_DRIFT_INDEX = {
  schema: 1,
  docs: [
    {
      id: "a",
      path: "a.md",
      title: "A",
      tags: [{ name: "topic:mcp", main: true }, "topic:mcq", "topic:old"],
    },
  ],
  tags: [
    { name: "topic:mcp", aliases: ["MCP"] },
    { name: "topic:yaml", aliases: ["MCP"] },
    { name: "topic:yaml" },
    { name: "topic:old", deprecated: "topic:mcp" },
    { name: "topic:gone", deprecated: "topic:none" },
  ],
};

/** `TAG_DRIFT_INDEX` が返すタグのずれの `where` と `kind`（この順） */
const TAG_DRIFT_ISSUES = [
  { where: "tags[2].name", kind: "duplicate_tag" },
  { where: "tags[1].aliases[0]", kind: "tag_alias_conflict" },
  { where: "tags[4].deprecated", kind: "broken_tag_replacement" },
  { where: "docs[0].tags[1]", kind: "unregistered_tag" },
  { where: "docs[0].tags[2]", kind: "deprecated_tag" },
];

/** 索引の値を、タグのずれを拾う処理に渡す入力にする */
async function createTagIssuesInput(raw: unknown) {
  const { normalizeIndex } = await import(
    "../../../../src/knowledge/index-shape.ts"
  );
  return { index: normalizeIndex(raw).index, raw, indexFile: "index.yaml" };
}

/** 文書の本文を、点検が読むトークンにする */
const tokensOf = (body: string) =>
  parseDocument({ body, docId: "guide", defaults: { ...DEFAULT_FEATURES } })
    .tokens;

// ずれの無い索引で空を返す（正常系）
test("test_check_index", async () => {
  // 準備
  const { checkIndex } = await loadCheck();
  const index = {
    schema: 1,
    docs: [
      { id: "arch", path: "arch.md", title: "アーキテクチャ" },
      { id: "api", path: "api.md", title: "API", related: ["arch"] },
    ],
    terms: [
      { id: "ws", term: "ワークスペース", meaning: "記録を置くフォルダ" },
    ],
  };
  const documents = { "arch.md": "# アーキテクチャ\n", "api.md": "# API\n" };
  // 実行
  const issues = checkIndex({ index, documents });
  // 検証
  expect(issues).toEqual([]);
});

// 消えた文書・索引に無い文書・切れた id・用語の重複 3 種を返す（正常系）
test("test_check_index_when_drift", async () => {
  // 準備
  const { checkIndex } = await loadCheck();
  const index = {
    schema: 1,
    docs: [
      { id: "api", path: "api.md", title: "API", related: ["gone"] },
      { id: "old", path: "old.md", title: "旧" },
      { id: "guide", path: "guide.md", title: "使い方" },
    ],
    terms: [
      { id: "ws1", term: "ワークスペース", meaning: "一つ目" },
      { id: "ws2", term: "ワークスペース", meaning: "二つ目" },
    ],
  };
  // 用語集の表の最初の行は 5 行目になる
  const documents = {
    "api.md": glossaryDocument([
      ["ワークスペース", "索引と重なる"],
      ["印", "HTML コメントで書く指定"],
    ]),
    "guide.md": glossaryDocument([["印", "api.md と重なる"]]),
    "new.md": "# 新しい文書\n",
  };
  // 実行
  const issues = checkIndex({
    index,
    documents,
    indexFile: "docs/index.yaml",
  });
  // 検証
  expect(issues.map((issue) => issue.kind)).toEqual([
    "missing_doc",
    "orphan_doc",
    "broken_ref",
    "duplicate_term",
    "duplicate_term",
    "duplicate_term",
  ]);
  expect(issues[0]).toMatchObject({
    file: "docs/index.yaml",
    where: "docs[1].path",
  });
  expect(issues[1]).toMatchObject({ file: "new.md", where: "" });
  expect(issues[2]).toMatchObject({
    file: "docs/index.yaml",
    where: "docs[0].related[0]",
  });
  expect(issues[2]?.message).toContain("gone");
  // 用語の重複は、重なった組の後ろの側を指し、message にもう片方の場所を書く
  expect(issues[3]).toMatchObject({
    file: "docs/index.yaml",
    where: "terms[1].term",
  });
  expect(issues[3]?.message).toContain("terms[0]");
  expect(issues[4]).toMatchObject({ file: "api.md", where: "5 行目" });
  expect(issues[4]?.message).toContain("docs/index.yaml");
  expect(issues[5]).toMatchObject({ file: "guide.md", where: "5 行目" });
  expect(issues[5]?.message).toContain("api.md");
});

// Schema に合わない索引で例外を投げず schema のずれを返す（異常系）
test("test_check_index_when_invalid_schema", async () => {
  // 準備
  const { checkIndex } = await loadCheck();
  const index = {
    docs: [
      { id: "a", path: "a.md", title: "A" },
      { id: "b", title: "B" },
    ],
  };
  const documents = { "a.md": "# A\n" };
  // 実行
  const issues = checkIndex({ index, documents });
  // 検証
  expect(issues).toContainEqual(
    expect.objectContaining({
      file: "index.yaml",
      where: "schema",
      kind: "schema",
    }),
  );
  expect(issues).toContainEqual(
    expect.objectContaining({
      file: "index.yaml",
      where: "docs[1].path",
      kind: "schema",
    }),
  );
  // docs[0] の文書について、ほかの種類のずれが無い
  expect(issues.every((issue) => issue.kind === "schema")).toBe(true);
});

// 本文に出たやめた言い方を、行とやめた言い方の組ごとに avoided_term で返す（正常系）
test("test_check_index_when_avoided_term", async () => {
  // 準備
  const { checkIndex } = await loadCheck();
  const index = {
    schema: 1,
    docs: [{ id: "guide", path: "guide.md", title: "手引き" }],
    terms: AVOIDED_TERMS,
  };
  const documents = { "guide.md": AVOIDED_GUIDE };
  // 実行
  const issues = checkIndex({ index, documents });
  // 検証
  // 見出し（1 行目）と行内のコード（5 行目）、同じ行に 2 回出た 3 行目の 2 回目は件数に入らない
  expect(
    issues.map(({ file, where, kind }) => ({ file, where, kind })),
  ).toEqual([
    { file: "guide.md", where: "3 行目", kind: "avoided_term" },
    { file: "guide.md", where: "8 行目", kind: "avoided_term" },
    { file: "guide.md", where: "12 行目", kind: "avoided_term" },
  ]);
  for (const issue of issues) {
    expect(issue.message).toContain("作業場");
    expect(issue.message).toContain("ワークスペース");
  }
});

// 正規化すると同じになる用語の語と、表記の違うやめた言い方を返す（正常系）
test("test_check_index_when_normalized_words", async () => {
  // 準備
  const { checkIndex } = await loadCheck();
  const index = {
    schema: 1,
    docs: [{ id: "guide", path: "guide.md", title: "手引き" }],
    terms: [
      { id: "mcp", term: "MCP", meaning: "Model Context Protocol" },
      {
        id: "mcp-kana",
        term: "エムシーピー",
        aliases: ["ｍｃｐ"],
        meaning: "MCP の読み",
      },
      {
        id: "ws",
        term: "ワークスペース",
        meaning: "記録を置くフォルダ",
        avoid: ["workplace"],
      },
    ],
  };
  const documents = { "guide.md": "WorkPlace を開く。\n" };
  // 実行
  const issues = checkIndex({ index, documents, indexFile: "docs/index.yaml" });
  // 検証
  expect(
    issues.map(({ file, where, kind }) => ({ file, where, kind })),
  ).toEqual([
    {
      file: "docs/index.yaml",
      where: "terms[1].aliases[0]",
      kind: "duplicate_term",
    },
    { file: "guide.md", where: "1 行目", kind: "avoided_term" },
  ]);
  // 重なりは後の側に記載した表記と先の側の場所を、やめた言い方は索引に記載した表記と代わりの用語を書く
  expect(issues[0]?.message).toContain("ｍｃｐ");
  expect(issues[0]?.message).toContain("terms[0].term");
  expect(issues[1]?.message).toContain("workplace");
  expect(issues[1]?.message).toContain("ワークスペース");
});

// 段落・段落の 2 行目・表のセルのやめた言い方をその行で返す（正常系）
test("test_find_avoided_terms", async () => {
  // 準備
  const { findAvoidedTerms } = await loadCheck();
  const tokens = tokensOf(AVOIDED_GUIDE);
  // 実行
  const issues = findAvoidedTerms({
    file: "guide.md",
    tokens,
    terms: AVOIDED_TERMS,
  });
  // 検証
  expect(issues.map((issue) => issue.where)).toEqual([
    "3 行目",
    "8 行目",
    "12 行目",
  ]);
  for (const issue of issues) {
    expect(issue.file).toBe("guide.md");
    expect(issue.kind).toBe("avoided_term");
    expect(issue.message).toContain("作業場");
    expect(issue.message).toContain("ワークスペース");
  }
});

// 表記の違うやめた言い方を拾い、表記の違う用語の別名は拾わない（正常系）
test("test_find_avoided_terms_when_notation_differs", async () => {
  // 準備
  const { findAvoidedTerms } = await loadCheck();
  const terms = [
    {
      id: "ws",
      term: "ワークスペース",
      aliases: ["WS"],
      meaning: "記録を置くフォルダ",
      avoid: ["workplace"],
    },
  ];
  // 1 行目の `ｗｓ` は用語の別名に当たり、3 行目の `WorkPlace` がやめた言い方に当たる
  const body = ["ｗｓ を開く。", "", "WorkPlace を開く。", ""].join("\n");
  // 実行
  const issues = findAvoidedTerms({
    file: "guide.md",
    tokens: tokensOf(body),
    terms,
  });
  // 検証
  expect(issues.map((issue) => issue.where)).toEqual(["3 行目"]);
  expect(issues[0]?.message).toContain("workplace");
  expect(issues[0]?.message).toContain("ワークスペース");
});

// 見出し・リンクの中・行内のコード・コードブロック・用語集の表の中のやめた言い方を返さない（正常系）
test("test_find_avoided_terms_ignores_code_links_and_headings", async () => {
  // 準備
  const { findAvoidedTerms } = await loadCheck();
  const body = [
    "# 作業場の手引き",
    "",
    "[作業場の一覧](./list.md)",
    "",
    "`作業場`",
    "",
    "```text",
    "作業場を開く",
    "```",
    "",
    "<!-- glossary: term=用語 meaning=意味 -->",
    "",
    "| 用語 | 意味 |",
    "| --- | --- |",
    "| 作業場 | 記録を置く場所 |",
    "",
    "<!-- /glossary -->",
    "",
  ].join("\n");
  // 実行
  const issues = findAvoidedTerms({
    file: "guide.md",
    tokens: tokensOf(body),
    terms: AVOIDED_TERMS,
  });
  // 検証
  expect(issues).toEqual([]);
});

// やめた言い方が用語の語の一部として出たところを数えず、同じ行に 2 回出たやめた言い方を 1 件にまとめる（正常系）
test("test_find_avoided_terms_prefers_term_words", async () => {
  // 準備
  const { findAvoidedTerms } = await loadCheck();
  const terms = [
    { id: "ws", term: "ワークスペース", meaning: "記録を置くフォルダ" },
    { id: "job", term: "仕事", meaning: "取り組むこと", avoid: ["ワーク"] },
  ];
  // 1 行目の ワークスペース は用語の語に当たり、3 行目の ワーク が 2 回だけやめた言い方に当たる
  const body = ["ワークスペースを開く。", "", "ワークとワーク。", ""].join(
    "\n",
  );
  // 実行
  const issues = findAvoidedTerms({
    file: "guide.md",
    tokens: tokensOf(body),
    terms,
  });
  // 検証
  expect(issues.map((issue) => issue.where)).toEqual(["3 行目"]);
});

// 同じやめた言い方を持つ用語が 2 つあるとき、先の用語を代わりに使う用語にする（正常系）
test("test_find_avoided_terms_prefers_first_term", async () => {
  // 準備
  const { findAvoidedTerms } = await loadCheck();
  const terms = [
    { term: "ワークスペース", avoid: ["作業場"] },
    { term: "作業スペース", avoid: ["作業場"] },
  ];
  // 実行
  const issues = findAvoidedTerms({
    file: "guide.md",
    tokens: tokensOf("作業場を開く。\n"),
    terms,
  });
  // 検証
  expect(issues).toHaveLength(1);
  expect(issues[0]?.message).toContain("ワークスペース");
  expect(issues[0]?.message).not.toContain("作業スペース");
});

// 用語集の表のやめた言い方を、表を持たない文書の本文から avoided_term で返す（正常系）
test("test_check_index_when_glossary_avoided_term", async () => {
  // 準備
  const { checkIndex } = await loadCheck();
  const index = {
    schema: 1,
    docs: [
      { id: "glossary", path: "glossary.md", title: "用語集" },
      { id: "guide", path: "guide.md", title: "手引き" },
    ],
  };
  const documents = {
    "glossary.md": AVOID_GLOSSARY_DOCUMENT,
    "guide.md": AVOID_GLOSSARY_GUIDE,
  };
  // 実行
  const issues = checkIndex({ index, documents });
  // 検証
  // glossary.md の表の中の 作業場・ワーク場 と、guide.md の 5 行目の ワークスペース はずれにならない
  expect(
    issues.map(({ file, where, kind }) => ({ file, where, kind })),
  ).toEqual([
    { file: "guide.md", where: "1 行目", kind: "avoided_term" },
    { file: "guide.md", where: "3 行目", kind: "avoided_term" },
  ]);
  expect(issues[0]?.message).toContain("作業場");
  expect(issues[0]?.message).toContain("ワークスペース");
  expect(issues[1]?.message).toContain("ワーク場");
  expect(issues[1]?.message).toContain("ワークスペース");
});

// タグの語彙の重なり・切れた振り替え先・語彙に無いタグ・やめたタグを返す（正常系）
test("test_check_index_when_tag_drift", async () => {
  // 準備
  const { checkIndex } = await loadCheck();
  const documents = { "a.md": "# A\n" };
  // 実行
  const issues = checkIndex({ index: TAG_DRIFT_INDEX, documents });
  // 検証
  expect(
    issues.map(({ file, where, kind }) => ({ file, where, kind })),
  ).toEqual(
    TAG_DRIFT_ISSUES.map((issue) => ({ file: "index.yaml", ...issue })),
  );
});

// 語彙を持たない索引ではタグのずれを返さない（正常系）
test("test_check_index_without_tag_vocabulary", async () => {
  // 準備
  const { checkIndex } = await loadCheck();
  const index = {
    schema: 1,
    docs: [
      { id: "arch", path: "arch.md", title: "アーキテクチャ" },
      {
        id: "api",
        path: "api.md",
        title: "API",
        related: ["arch"],
        tags: ["topic:mcq"],
      },
    ],
    terms: [
      { id: "ws", term: "ワークスペース", meaning: "記録を置くフォルダ" },
    ],
  };
  const documents = { "arch.md": "# アーキテクチャ\n", "api.md": "# API\n" };
  // 実行
  const issues = checkIndex({ index, documents });
  // 検証
  expect(issues).toEqual([]);
});

// 5 種のずれをこの順で返す（正常系）
test("test_find_tag_issues", async () => {
  // 準備
  const { findTagIssues } = await loadCheck();
  const input = await createTagIssuesInput(TAG_DRIFT_INDEX);
  // 実行
  const issues = findTagIssues(input);
  // 検証
  expect(issues.map(({ where, kind }) => ({ where, kind }))).toEqual(
    TAG_DRIFT_ISSUES,
  );
  expect(issues.every((issue) => issue.file === "index.yaml")).toBe(true);
  const unregistered = issues.find(
    (issue) => issue.kind === "unregistered_tag",
  );
  expect(unregistered?.message).toContain("topic:mcq");
  expect(unregistered?.message).toContain("topic:mcp");
  const deprecated = issues.find((issue) => issue.kind === "deprecated_tag");
  expect(deprecated?.message).toContain("topic:old");
  expect(deprecated?.message).toContain("topic:mcp");
});

// 別名で付けた文書のタグをずれにしない（正常系）
test("test_find_tag_issues_when_alias", async () => {
  // 準備
  const { findTagIssues } = await loadCheck();
  const input = await createTagIssuesInput({
    schema: 1,
    docs: [{ id: "a", path: "a.md", title: "A", tags: ["MCP"] }],
    tags: [{ name: "topic:mcp", aliases: ["MCP"] }],
  });
  // 実行
  const issues = findTagIssues(input);
  // 検証
  expect(issues).toEqual([]);
});

// ほかのタグの `name` と同じ別名を `tag_alias_conflict` にする（正常系）
test("test_find_tag_issues_when_alias_matches_name", async () => {
  // 準備
  const { findTagIssues } = await loadCheck();
  const input = await createTagIssuesInput({
    schema: 1,
    docs: [],
    tags: [
      { name: "topic:mcp" },
      { name: "topic:model", aliases: ["topic:mcp"] },
    ],
  });
  // 実行
  const issues = findTagIssues(input);
  // 検証
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({
    where: "tags[1].aliases[0]",
    kind: "tag_alias_conflict",
  });
  expect(issues[0]?.message).toContain("topic:mcp");
});

// 近いタグが無いことを `message` に書く（正常系）
test("test_find_tag_issues_when_no_near_tag", async () => {
  // 準備
  const { findTagIssues } = await loadCheck();
  const input = await createTagIssuesInput({
    schema: 1,
    docs: [{ id: "a", path: "a.md", title: "A", tags: ["kind:guide"] }],
    tags: [{ name: "topic:mcp" }],
  });
  // 実行
  const issues = findTagIssues(input);
  // 検証
  expect(issues).toHaveLength(1);
  expect(issues[0]?.kind).toBe("unregistered_tag");
  expect(issues[0]?.message).toContain("近いタグもありません");
  expect(issues[0]?.message).toContain("`kind:guide` を追加");
});

// 語彙を持たない索引では空を返す（正常系）
test("test_find_tag_issues_without_vocabulary", async () => {
  // 準備
  const { findTagIssues } = await loadCheck();
  const input = await createTagIssuesInput({
    schema: 1,
    docs: [{ id: "a", path: "a.md", title: "A", tags: ["topic:mcq"] }],
  });
  // 実行
  const issues = findTagIssues(input);
  // 検証
  expect(issues).toEqual([]);
});

/** 索引の値を、関連のずれを拾う処理に渡す索引にする */
async function createIndexOf(raw: unknown) {
  const { normalizeIndex } = await import(
    "../../../../src/knowledge/index-shape.ts"
  );
  return normalizeIndex(raw).index;
}

/** 文書 `a`・`b` が互いを `change_together` で記載した索引 */
const CHANGE_TOGETHER_INDEX = {
  schema: 1,
  docs: [
    {
      id: "a",
      path: "a.md",
      title: "A",
      related: [
        {
          to: "b",
          type: "change_together",
          when: "索引の Schema を変えるとき",
        },
      ],
    },
    {
      id: "b",
      path: "b.md",
      title: "B",
      related: [
        {
          to: "a",
          type: "change_together",
          when: "索引の Schema を変えるとき",
        },
      ],
    },
  ],
};

// 文字列の関連・片側だけの change_together・本文のリンクと重なる関連を返す（正常系）
test("test_check_index_when_related_drift", async () => {
  // 準備
  const { checkIndex } = await loadCheck();
  const index = {
    schema: 1,
    docs: [
      {
        id: "a",
        path: "a.md",
        title: "A",
        related: [
          {
            to: "b",
            type: "change_together",
            when: "索引の Schema を変えるとき",
          },
          { to: "c", type: "references", when: "使い方を確かめるとき" },
        ],
      },
      { id: "b", path: "b.md", title: "B" },
      { id: "c", path: "c.md", title: "C", related: ["a"] },
    ],
  };
  // `a.md` の本文が `c.md` へリンクする
  const documents = {
    "a.md": "# A\n\n[C](c.md)\n",
    "b.md": "# B\n",
    "c.md": "# C\n",
  };
  // 実行
  const issues = checkIndex({ index, documents });
  // 検証
  expect(
    issues.map(({ file, where, kind }) => ({ file, where, kind })),
  ).toEqual([
    {
      file: "index.yaml",
      where: "docs[2].related[0]",
      kind: "untyped_related",
    },
    {
      file: "index.yaml",
      where: "docs[0].related[0]",
      kind: "one_sided_change_together",
    },
    {
      file: "index.yaml",
      where: "docs[0].related[1]",
      kind: "related_link_overlap",
    },
  ]);
  const oneSided = issues.find(
    (issue) => issue.kind === "one_sided_change_together",
  );
  expect(oneSided?.message).toContain("b");
  expect(oneSided?.message).toContain("a");
  const untyped = issues.find((issue) => issue.kind === "untyped_related");
  expect(untyped?.message).toContain("to");
  expect(untyped?.message).toContain("type");
  expect(untyped?.message).toContain("when");
});

// `changedPaths` で組の片方だけが変わったときだけ missed_change_together を返す（正常系）
test("test_check_index_when_change_together_missed", async () => {
  // 準備
  const { checkIndex } = await loadCheck();
  const index = {
    ...CHANGE_TOGETHER_INDEX,
    docs: [
      ...CHANGE_TOGETHER_INDEX.docs,
      {
        id: "c",
        path: "c.md",
        title: "C",
        related: [{ to: "a", type: "references", when: "前提を確かめるとき" }],
      },
    ],
  };
  const documents = {
    "a.md": "# A\n",
    "b.md": "# B\n",
    "c.md": "# C\n",
  };
  // 実行
  const unchecked = checkIndex({ index, documents });
  const missed = checkIndex({ index, documents, changedPaths: ["a.md"] });
  const bothChanged = checkIndex({
    index,
    documents,
    changedPaths: ["a.md", "b.md"],
  });
  // 検証
  expect(unchecked).toEqual([]);
  expect(missed).toHaveLength(1);
  expect(missed[0]).toMatchObject({
    file: "b.md",
    where: "",
    kind: "missed_change_together",
  });
  expect(missed[0]?.message).toContain("a.md");
  expect(bothChanged).toEqual([]);
});

// 索引に無い `to` のオブジェクトの関連を、`to` を指す broken_ref にする（正常系）
test("test_check_index_when_broken_related_object", async () => {
  // 準備
  const { checkIndex } = await loadCheck();
  const index = {
    schema: 1,
    docs: [
      {
        id: "api",
        path: "api.md",
        title: "API",
        related: [
          { to: "zzz", type: "references", when: "使い方を確かめるとき" },
        ],
      },
      { id: "arch", path: "arch.md", title: "アーキテクチャ" },
    ],
  };
  const documents = { "api.md": "# API\n", "arch.md": "# アーキテクチャ\n" };
  // 実行
  const issues = checkIndex({ index, documents });
  // 検証
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({
    file: "index.yaml",
    where: "docs[0].related[0].to",
    kind: "broken_ref",
  });
  expect(issues[0]?.message).toContain("zzz");
});

// 文字列の関連・片側だけの change_together・本文のリンクと重なる関連を種類の順に返す（正常系）
test("test_find_related_issues", async () => {
  // 準備
  const { findRelatedIssues } = await loadCheck();
  const index = await createIndexOf({
    schema: 1,
    docs: [
      {
        id: "a",
        path: "a.md",
        title: "A",
        related: [
          {
            to: "b",
            type: "change_together",
            when: "索引の Schema を変えるとき",
          },
          { to: "c", type: "references", when: "使い方を確かめるとき" },
        ],
      },
      { id: "b", path: "b.md", title: "B" },
      { id: "c", path: "c.md", title: "C", related: ["a"] },
    ],
  });
  // 実行
  const issues = findRelatedIssues({
    index,
    links: { a: ["c.md"], b: [], c: [] },
    indexFile: "index.yaml",
  });
  // 検証
  expect(issues.map(({ where, kind }) => ({ where, kind }))).toEqual([
    { where: "docs[2].related[0]", kind: "untyped_related" },
    { where: "docs[0].related[0]", kind: "one_sided_change_together" },
    { where: "docs[0].related[1]", kind: "related_link_overlap" },
  ]);
  expect(issues.every((issue) => issue.file === "index.yaml")).toBe(true);
});

// 両側に記載した change_together は、本文のリンクがあってもずれにしない（正常系）
test("test_find_related_issues_when_change_together_both_sides", async () => {
  // 準備
  const { findRelatedIssues } = await loadCheck();
  const index = await createIndexOf(CHANGE_TOGETHER_INDEX);
  // 実行
  const issues = findRelatedIssues({
    index,
    links: { a: ["b.md"], b: ["./a.md"] },
    indexFile: "index.yaml",
  });
  // 検証
  expect(issues).toEqual([]);
});

// 索引に無い相手への関連は、片側だけの change_together にもリンクの重なりにもしない（正常系）
test("test_find_related_issues_when_target_missing", async () => {
  // 準備
  const { findRelatedIssues } = await loadCheck();
  const index = await createIndexOf({
    schema: 1,
    docs: [
      {
        id: "a",
        path: "a.md",
        title: "A",
        related: [
          { to: "zzz", type: "change_together", when: "索引を変えるとき" },
          { to: "yyy", type: "references", when: "使い方を確かめるとき" },
        ],
      },
    ],
  });
  // 実行
  const issues = findRelatedIssues({
    index,
    links: { a: ["yyy.md"] },
    indexFile: "index.yaml",
  });
  // 検証
  expect(issues).toEqual([]);
});

// `links` にキーを持たない文書は、リンクの重なりを確かめない（正常系）
test("test_find_related_issues_without_body", async () => {
  // 準備
  const { findRelatedIssues } = await loadCheck();
  const index = await createIndexOf({
    schema: 1,
    docs: [
      {
        id: "a",
        path: "a.md",
        title: "A",
        related: [
          { to: "b", type: "references", when: "使い方を確かめるとき" },
        ],
      },
      { id: "b", path: "b.md", title: "B" },
    ],
  });
  // 実行
  const issues = findRelatedIssues({
    index,
    links: {},
    indexFile: "index.yaml",
  });
  // 検証
  expect(issues).toEqual([]);
});

// 片側だけに記載した組でも、片方だけが変わったら変わっていない側を返す（正常系）
test("test_find_missed_change_together", async () => {
  // 準備
  const { findMissedChangeTogether } = await loadCheck();
  const index = await createIndexOf({
    schema: 1,
    docs: [
      {
        id: "a",
        path: "a.md",
        title: "A",
        related: [
          {
            to: "b",
            type: "change_together",
            when: "索引の Schema を変えるとき",
          },
        ],
      },
      { id: "b", path: "b.md", title: "B" },
    ],
  });
  // 実行
  const issues = findMissedChangeTogether({ index, changedPaths: ["b.md"] });
  // 検証
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({
    file: "a.md",
    where: "",
    kind: "missed_change_together",
  });
  expect(issues[0]?.message).toContain("b.md");
});

// 両側に記載した組を 1 つだけ返す（正常系）
test("test_find_missed_change_together_when_both_sides_written", async () => {
  // 準備
  const { findMissedChangeTogether } = await loadCheck();
  const index = await createIndexOf(CHANGE_TOGETHER_INDEX);
  // 実行
  const issues = findMissedChangeTogether({ index, changedPaths: ["./a.md"] });
  // 検証
  expect(issues).toHaveLength(1);
  expect(issues[0]?.file).toBe("b.md");
});

// 両方が変わった組と、どちらも変わっていない組は返さない（正常系）
test("test_find_missed_change_together_when_both_or_none_changed", async () => {
  // 準備
  const { findMissedChangeTogether } = await loadCheck();
  const index = await createIndexOf(CHANGE_TOGETHER_INDEX);
  // 実行
  const bothChanged = findMissedChangeTogether({
    index,
    changedPaths: ["a.md", "b.md"],
  });
  const noneChanged = findMissedChangeTogether({
    index,
    changedPaths: ["other.md"],
  });
  // 検証
  expect(bothChanged).toEqual([]);
  expect(noneChanged).toEqual([]);
});

// change_together でない関連と、索引に無い相手の組は数えない（正常系）
test("test_find_missed_change_together_ignores_other_types", async () => {
  // 準備
  const { findMissedChangeTogether } = await loadCheck();
  const index = await createIndexOf({
    schema: 1,
    docs: [
      { id: "a", path: "a.md", title: "A" },
      {
        id: "c",
        path: "c.md",
        title: "C",
        related: [
          { to: "a", type: "references", when: "前提を確かめるとき" },
          { to: "zzz", type: "change_together", when: "索引を変えるとき" },
        ],
      },
    ],
  });
  // 実行
  const issues = findMissedChangeTogether({ index, changedPaths: ["a.md"] });
  // 検証
  expect(issues).toEqual([]);
});
