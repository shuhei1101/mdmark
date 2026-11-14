import type { Token } from "markdown-it";
import { expect, test } from "vitest";
import type { RenderEnv } from "../../../../../src/render/parser.ts";
import { createEnv } from "../../../helpers/env.ts";
import {
  findTag,
  findTags,
  innerHtml,
  plainText,
} from "../../../helpers/html.ts";
import { mapRange } from "../../../helpers/map.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** 解析の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadParser = () => import("../../../../../src/render/parser.ts");

/** 注記の状態 */
type AnnotationState = {
  definitions: Map<string, { tokens: Token[]; line: number }>;
  duplicates: Array<{ id: string; line: number }>;
  order: string[];
  refs: Map<string, Array<{ href: string; owner?: string }>>;
};

/** Markdown を解析し、トークンと解析の環境を返却する */
async function parse(
  markdown: string,
): Promise<{ tokens: Token[]; env: RenderEnv }> {
  const { createParser } = await loadParser();
  const env = createEnv();
  const tokens = createParser().parse(markdown, env);
  return { tokens, env };
}

/** 解析の環境の注記の状態 */
function annotationsOf(env: RenderEnv): AnnotationState {
  const state = (env as RenderEnv & { mdmarkAnnotations?: AnnotationState })
    .mdmarkAnnotations;
  if (state === undefined) {
    throw new Error("注記の状態が無い");
  }
  return state;
}

/** 行内のトークンを全て返却する */
function inlineChildren(tokens: Token[]): Token[] {
  return tokens.flatMap((token) => token.children ?? []);
}

/** `id` の要素の中身を返却する */
function byId(html: string, id: string): string {
  return innerHtml(html, `id="${id}"`);
}

/** インターフェース定義『文書をHTML文字列にする』の「正常系（注記）」の文書 */
const ANNOTATIONS_MARKDOWN = [
  "入力の値を判定してから、次の処理へ進む※[cond]。",
  "",
  "| 判定 | 結果 |",
  "| --- | --- |",
  "| 満たす | 次へ進む |",
  "| 満たさない | 処理しない※[cond] |",
  "",
  "画像を埋め込む[^1]※[img]。",
  "",
  "※[img]: 画像は data URL で埋める。",
  "",
  "※[cond]: 条件を満たさないときは次の工程へ進む。",
  "",
  "[^1]: 補足の文",
  "",
].join("\n");

// 定義と参照を、参照の順の番号のマーカーと末尾の一覧にする（正常系）
test("test_use_annotations", () => {
  // 準備・実行
  const { html } = renderDoc(ANNOTATIONS_MARKDOWN);
  // 検証
  for (const id of ["mdmark-noteref-1-0", "mdmark-noteref-1-1"]) {
    expect(findTag(html, `id="${id}"`)).toContain('href="#mdmark-note-1"');
    expect(plainText(byId(html, id))).toBe("注記 1");
  }
  expect(findTag(html, 'id="mdmark-noteref-1-0"')).toContain(
    'aria-describedby="mdmark-note-tip-1-0"',
  );
  expect(plainText(byId(html, "mdmark-note-tip-1-0"))).toBe(
    "注記 1条件を満たさないときは次の工程へ進む。",
  );
  expect(plainText(byId(html, "mdmark-noteref-2-0"))).toBe("注記 2");
  const refs = findTags(html, "mdmark-note-ref");
  expect(refs).toHaveLength(3);
  expect(refs[2]).toContain("is-after-ref");
  expect(refs[0]).not.toContain("is-after-ref");
  expect(html).toContain('id="mdmark-fnref-1-0"');
  const footnotesAt = html.indexOf('<details class="mdmark-footnotes">');
  const notesAt = html.indexOf(
    '<details class="mdmark-footnotes mdmark-notes">',
  );
  expect(footnotesAt).toBeGreaterThan(-1);
  expect(notesAt).toBeGreaterThan(footnotesAt);
  const notes = html.slice(notesAt);
  expect(innerHtml(notes, "<summary")).toBe("注記（2 件）");
  expect(notes.indexOf('id="mdmark-note-1"')).toBeLessThan(
    notes.indexOf('id="mdmark-note-2"'),
  );
  expect(findTags(byId(html, "mdmark-note-1"), "mdmark-fn-back")).toHaveLength(
    2,
  );
  expect(html).not.toContain("※[");
});

// リンクになる [ID] はリンクを優先する（正常系）
test("test_use_annotations_when_link_reference", () => {
  // 準備
  const markdown = [
    "参照 ※[cond] と ※[site] と ※[site][] と ※[cond](https://example.com/a) 。",
    "",
    "[Site]: https://example.com/b",
    "",
    "※[cond]: 条件の補足",
    "",
    "※[site]: 使われない補足",
    "",
  ].join("\n");
  // 実行
  const { html, warnings } = renderDoc(markdown);
  // 検証
  expect(findTags(html, "mdmark-note-ref")).toHaveLength(1);
  expect(html).toContain('id="mdmark-noteref-1-0"');
  expect(
    html.split('※<a href="https://example.com/b">site</a>').length - 1,
  ).toBe(2);
  expect(html).toContain('※<a href="https://example.com/a">cond</a>');
  expect(warnings.map((warning) => warning.kind)).toEqual([
    "annotation_unused",
  ]);
  expect(html).not.toContain("使われない補足");
});

// 機能のオフで記載した文字のまま残す（正常系）
test("test_use_annotations_when_disabled", () => {
  // 準備
  const markdown = "判定する※[cond]。\n\n※[cond]: 条件の補足\n";
  // 実行
  const { html, warnings } = renderDoc(markdown, { annotations: false });
  // 検証
  expect(html).toContain("<p>判定する※[cond]。</p>");
  expect(html).toContain("<p>※[cond]: 条件の補足</p>");
  expect(html).not.toContain("mdmark-note-ref");
  expect(html).not.toContain("mdmark-notes");
  expect(warnings).toEqual([]);
});

// 字下げ 4 で続く段落を定義に含める（正常系）
test("test_read_annotation_definition", async () => {
  // 準備
  const markdown = "※[cond]: 1 段落目\n\n    2 段落目\n\n本文※[cond]。\n";
  // 実行
  const { env } = await parse(markdown);
  // 検証
  const definition = annotationsOf(env).definitions.get("cond");
  expect(definition?.line).toBe(1);
  const texts = (definition?.tokens ?? [])
    .filter((token) => token.type === "inline")
    .map((token) => token.content);
  expect(texts).toEqual(["1 段落目", "2 段落目"]);
});

// 同じ ID の 2 つ目の定義を duplicates に記録する（異常系）
test("test_read_annotation_definition_when_duplicate", async () => {
  // 準備
  const markdown = "※[cond]: 前の定義\n\n※[cond]: 後の定義\n\n本文※[cond]。\n";
  // 実行
  const { env } = await parse(markdown);
  // 検証
  const state = annotationsOf(env);
  const texts = (state.definitions.get("cond")?.tokens ?? [])
    .filter((token) => token.type === "inline")
    .map((token) => token.content);
  expect(texts).toEqual(["前の定義"]);
  expect(state.duplicates).toEqual([{ id: "cond", line: 3 }]);
});

// 直前の文字に続く ※[ID] を参照のトークンにする（正常系）
test("test_read_annotation_reference", async () => {
  // 準備
  const markdown = "判定する※[cond]。\n\n※[cond]: 補足\n";
  // 実行
  const { tokens } = await parse(markdown);
  // 検証
  const children = inlineChildren(tokens);
  const refs = children.filter(
    (token) => token.type === "mdmark_annotation_ref",
  );
  expect(refs).toHaveLength(1);
  expect(refs[0]?.meta?.id).toBe("cond");
  const before = children[children.indexOf(refs[0] as Token) - 1];
  expect(before?.type).toBe("text");
  expect(before?.content).toBe("判定する");
});

// ※ の無い [ID] は読み込まない（正常系）
test("test_read_annotation_reference_when_no_mark", async () => {
  // 準備
  const markdown = "判定する[cond]。\n\n※[cond]: 補足\n";
  // 実行
  const { tokens } = await parse(markdown);
  const { html } = renderDoc(markdown);
  // 検証
  expect(
    inlineChildren(tokens).some(
      (token) => token.type === "mdmark_annotation_ref",
    ),
  ).toBe(false);
  expect(html).toContain("<p>判定する[cond]。</p>");
});

// リンクの参照の定義がある ID は link がリンクにする（正常系）
test("test_read_annotation_reference_when_link_definition", async () => {
  // 準備
  const markdown = "前 ※[Site] 後\n\n[site]: https://example.com\n";
  // 実行
  const { tokens } = await parse(markdown);
  const { html } = renderDoc(markdown);
  // 検証
  expect(
    inlineChildren(tokens).some(
      (token) => token.type === "mdmark_annotation_ref",
    ),
  ).toBe(false);
  expect(html).toContain('※<a href="https://example.com">Site</a>');
});

// 定義の順によらず最初に参照した順に番号を振る（正常系）
test("test_collect_annotations", async () => {
  // 準備
  const markdown = [
    "※[img]: 画像の補足",
    "",
    "※[cond]: 条件の補足",
    "",
    "判定する※[cond]。画像を埋める※[img]。",
    "",
  ].join("\n");
  // 実行
  const { env } = await parse(markdown);
  // 検証
  expect(annotationsOf(env).order).toEqual(["cond", "img"]);
});

// 定義の無い参照・参照されていない定義・2 つ目の定義を警告にする（異常系）
test("test_collect_annotations_when_mismatch", () => {
  // 準備
  const markdown = [
    "未定義※[missing] と既定※[cond]。",
    "",
    "※[cond]: 前の定義",
    "",
    "※[cond]: 後の定義",
    "",
    "※[unused]: 使用しない",
    "",
  ].join("\n");
  // 実行
  const { html, warnings } = renderDoc(markdown);
  // 検証
  expect(warnings.map((warning) => [warning.kind, warning.line])).toEqual([
    ["annotation_undefined", 1],
    ["annotation_duplicate", 5],
    ["annotation_unused", 7],
  ]);
  expect(warnings[0]?.message).toContain("missing");
  expect(html).toContain("※[missing]");
  expect(plainText(byId(html, "mdmark-note-tip-1-0"))).toBe("注記 1前の定義");
  expect(html).not.toContain("後の定義");
  expect(html).not.toContain("使用しない");
  expect(findTags(html, "mdmark-fn-item")).toHaveLength(1);
});

// map の補足の注記の参照を数え、戻り先を持ち主の id にする（正常系）
test("test_collect_annotations_when_map", async () => {
  // 準備
  const markdown = `${mapRange({
    mermaid: "flowchart LR\n  judge[判定] --> next[次へ]\n",
    data: '{"version": 1, "notes": {"judge": {"annotations": ["cond"]}}}',
  })}\n※[cond]: 条件の補足\n`;
  // 実行
  const { env } = await parse(markdown);
  // 検証
  const state = annotationsOf(env);
  expect(state.order).toEqual(["cond"]);
  expect(state.refs.get("cond")).toEqual([
    {
      href: "#mdmark-note-owner-1-judge",
      owner: "mdmark-note-owner-1-judge",
    },
  ]);
});

// 脚注の一覧の後ろに注記の一覧を配置する（正常系）
test("test_build_annotation_list", () => {
  // 準備
  const markdown = "本文[^1]と注記※[cond]。\n\n[^1]: 脚注\n\n※[cond]: 注記\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const footnotes = '<details class="mdmark-footnotes">';
  const notes = '<details class="mdmark-footnotes mdmark-notes">';
  expect(html).toContain(footnotes);
  expect(html.indexOf(notes)).toBeGreaterThan(html.indexOf(footnotes));
  // 2 つの一覧の間に別の要素を挟まない
  const between = html.slice(html.indexOf(footnotes), html.indexOf(notes));
  expect(between.endsWith("</details>")).toBe(true);
});

// 定義を出力しない（正常系）
test("test_take_annotation_definitions", () => {
  // 準備
  const markdown = "本文※[cond]。\n\n※[cond]: 定義の本文\n\n終わり\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).not.toContain("<p>定義の本文</p>");
  expect(html.split("定義の本文").length - 1).toBe(2);
  expect(byId(html, "mdmark-note-tip-1-0")).toContain("定義の本文");
  expect(byId(html, "mdmark-note-1")).toContain("定義の本文");
  expect(html.indexOf("<p>終わり</p>")).toBeLessThan(
    html.indexOf("mdmark-notes"),
  );
});
