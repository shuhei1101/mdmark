// PoC: 照合した語を、本文の Markdown の行（1 から）と行の中の位置（UTF-16）へ戻せるかを確かめる
// 実行: node poc/term-position.ts
import type { Token } from "markdown-it";
import { decodeHTML } from "entities";
import {
  findWords,
  forEachInline,
  matchableChildren,
} from "../src/knowledge/dictionary.ts";
import { parseDocument } from "../src/knowledge/references.ts";

/** 本文の中の位置 */
type Position = { line: number; start: number; end: number };

/** 一致 1 つ */
type Found = { word: string; where: "inline" | "html" | "diagram"; position: Position };

/** 本文の頭からの位置を、行（1 から）と行の中の位置にする */
function toLineColumn(body: string, offset: number): { line: number; column: number } {
  const before = body.slice(0, offset);
  const line = before.split("\n").length;
  return { line, column: offset - (before.lastIndexOf("\n") + 1) };
}

/** 行（0 から）の頭の位置 */
function lineOffset(body: string, line: number): number {
  let offset = 0;
  for (let i = 0; i < line; i++) {
    offset = body.indexOf("\n", offset) + 1;
  }
  return offset;
}

/** 本文の `cursor` から、文字 `text` を 1 文字ずつ当て、各文字の本文の位置を返す。エスケープと実体参照を戻し、当たらない本文の文字（記法の記号）は飛ばす */
function align(body: string, cursor: number, text: string): { offsets: number[]; end: number } {
  const offsets: number[] = [];
  let at = cursor;
  for (let i = 0; i < text.length; ) {
    const char = text[i] as string;
    if (body.startsWith(char, at)) {
      offsets.push(at);
      at += 1;
      i += 1;
      continue;
    }
    if (body[at] === "\\" && body[at + 1] === char) {
      offsets.push(at);
      at += 2;
      i += 1;
      continue;
    }
    const entity = /^&(#\d+|#x[0-9a-f]+|[a-z0-9]+);/i.exec(body.slice(at));
    if (entity) {
      const decoded = decodeHTML(entity[0]);
      if (text.startsWith(decoded, i)) {
        for (let k = 0; k < decoded.length; k++) {
          offsets.push(at);
        }
        at += entity[0].length;
        i += decoded.length;
        continue;
      }
    }
    if (at >= body.length) {
      throw new Error(`当たらない: ${JSON.stringify(text)} の ${i} 文字目`);
    }
    // 記法の記号・行頭の字下げ・引用の印など、文字に出ない本文の文字を飛ばす
    at += 1;
  }
  offsets.push(at);
  return { offsets, end: at };
}

/** 閉じの括弧の位置（入れ子を数える） */
function closing(body: string, open: number, pair: [string, string]): number {
  let depth = 0;
  for (let at = open; at < body.length; at++) {
    if (body[at] === "\\") {
      at += 1;
    } else if (body[at] === pair[0]) {
      depth += 1;
    } else if (body[at] === pair[1]) {
      depth -= 1;
      if (depth === 0) {
        return at;
      }
    }
  }
  return body.length;
}

/** 行内のトークンの子を頭から本文へ当て、照合してよい子の文字の各位置を返す */
function inlineOffsets(body: string, inline: Token, start: number): { byChild: Map<number, number[]>; end: number } {
  const byChild = new Map<number, number[]>();
  const matchable = new Set(matchableChildren(inline));
  let cursor = start;
  (inline.children ?? []).forEach((child, index) => {
    switch (child.type) {
      case "text": {
        const { offsets, end } = align(body, cursor, child.content);
        if (matchable.has(index)) {
          byChild.set(index, offsets);
        }
        cursor = end;
        break;
      }
      case "code_inline": {
        const open = body.indexOf(child.markup, cursor);
        const inner = body.indexOf(child.content, open + child.markup.length);
        cursor = body.indexOf(child.markup, inner + child.content.length) + child.markup.length;
        break;
      }
      case "link_open":
        cursor = child.markup === "autolink" ? body.indexOf("<", cursor) + 1 : body.indexOf("[", cursor) + 1;
        break;
      case "link_close": {
        if (child.markup === "autolink") {
          cursor = body.indexOf(">", cursor) + 1;
          break;
        }
        const close = body.indexOf("]", cursor);
        const next = body[close + 1];
        cursor =
          next === "("
            ? closing(body, close + 1, ["(", ")"]) + 1
            : next === "["
              ? body.indexOf("]", close + 1) + 1
              : close + 1;
        break;
      }
      case "image": {
        const open = body.indexOf("![", cursor);
        const close = closing(body, open + 1, ["[", "]"]);
        cursor = body[close + 1] === "(" ? closing(body, close + 1, ["(", ")"]) + 1 : close + 1;
        break;
      }
      case "softbreak":
      case "hardbreak":
        cursor = body.indexOf("\n", cursor) + 1;
        break;
      case "html_inline":
        cursor = body.indexOf(child.content, cursor) + child.content.length;
        break;
      default:
        // 強調などの開きと閉じの記号
        if (child.markup) {
          cursor = body.indexOf(child.markup, cursor) + child.markup.length;
        }
    }
  });
  return { byChild, end: cursor };
}

/** 本文の地の文の一致と位置 */
function inlineMatches(body: string, tokens: Token[], words: string[]): Found[] {
  const found: Found[] = [];
  // 同じ行から始まる行内のトークン（表のセル）は、前のセルの続きから当てる
  let lastLine = -1;
  let lastEnd = 0;
  forEachInline(tokens, (inline) => {
    const startLine = inline.map?.[0] ?? 0;
    const start = startLine === lastLine ? lastEnd : lineOffset(body, startLine);
    const { byChild, end } = inlineOffsets(body, inline, start);
    lastLine = startLine;
    lastEnd = end;
    for (const [index, offsets] of byChild) {
      const text = inline.children?.[index]?.content ?? "";
      for (const match of findWords(text, words)) {
        found.push({ word: match.word, where: "inline", position: position(body, offsets[match.start] ?? 0, offsets[match.end] ?? 0) });
      }
    }
  });
  return found;
}

/** 本文の頭からの始まりと終わりを、行と行の中の位置にする */
function position(body: string, from: number, to: number): Position {
  const start = toLineColumn(body, from);
  const end = toLineColumn(body, to);
  if (start.line !== end.line) {
    throw new Error("一致が行をまたぐ");
  }
  return { line: start.line, start: start.column, end: end.column };
}

/** 埋め込んだ HTML の文字の一致と位置（リンクの中と図の部品の custom element を除く） */
function htmlMatches(body: string, tokens: Token[], words: string[]): Found[] {
  const found: Found[] = [];
  for (const token of tokens) {
    if (token.type !== "fence" || token.info.trim() !== "html") {
      continue;
    }
    const contentStart = lineOffset(body, (token.map?.[0] ?? 0) + 1);
    const source = token.content;
    // 図の部品の custom element とリンクの範囲は文字を照合しない
    const skipped: Array<[number, number]> = [];
    for (const m of source.matchAll(/<mdmark-(flow|sequence|chart|param)\b[^>]*>[\s\S]*?<\/mdmark-\1\s*>|<a\b[^>]*>[\s\S]*?<\/a\s*>/gi)) {
      skipped.push([m.index, m.index + m[0].length]);
    }
    for (const m of source.matchAll(/>([^<]+)</g)) {
      const textStart = m.index + 1;
      if (skipped.some(([from, to]) => textStart >= from && textStart < to)) {
        continue;
      }
      const raw = m[1] as string;
      // termsFilter と同じく、逃がした文字を戻してから照合する
      const text = decodeHTML(raw);
      const { offsets } = align(body, contentStart + textStart, text);
      for (const match of findWords(text, words)) {
        found.push({ word: match.word, where: "html", position: position(body, offsets[match.start] ?? 0, offsets[match.end] ?? 0) });
      }
    }
  }
  return found;
}

/** 図の部品の定義（印の範囲の json のコードブロックと、HTML の中の custom element）の {{語}} の一致と位置 */
function diagramMatches(body: string, tokens: Token[], terms: Set<string>): Found[] {
  const found: Found[] = [];
  /** 定義の JSON の文字列を戻し、{{語}} の語の位置を本文へ戻す */
  const scan = (source: string, sourceStart: number): void => {
    for (const literal of source.matchAll(/"(?:[^"\\]|\\.)*"/g)) {
      const decoded = JSON.parse(literal[0]) as string;
      // JSON のエスケープを数えて、戻した文字の各位置を本文の位置にする
      const offsets: number[] = [];
      let at = sourceStart + literal.index + 1;
      const raw = literal[0].slice(1, -1);
      for (let r = 0; r < raw.length; ) {
        offsets.push(at);
        if (raw[r] === "\\") {
          const step = raw[r + 1] === "u" ? 6 : 2;
          r += step;
          at += step;
        } else {
          r += 1;
          at += 1;
        }
      }
      offsets.push(at);
      for (const m of decoded.matchAll(/\{\{(.+?)\}\}/g)) {
        const word = m[1] as string;
        if (!terms.has(word)) {
          continue;
        }
        const wordStart = m.index + 2;
        found.push({ word, where: "diagram", position: position(body, offsets[wordStart] ?? 0, offsets[wordStart + word.length] ?? 0) });
      }
    }
  };
  for (const token of tokens) {
    if (token.type !== "fence") {
      continue;
    }
    const contentStart = lineOffset(body, (token.map?.[0] ?? 0) + 1);
    const info = token.info.trim();
    if (info === "json") {
      scan(token.content, contentStart);
    } else if (info === "html") {
      for (const m of token.content.matchAll(/(<mdmark-(flow|sequence|chart|param)\b[^>]*>)([\s\S]*?)<\/mdmark-\2\s*>/gi)) {
        scan(m[3] as string, contentStart + m.index + (m[1] as string).length);
      }
    }
  }
  return found;
}

// ─── 見本 ───

/** 見本 1 つ: 本文と、地の文で一致になるはずの語の数 */
type Sample = { name: string; body: string };

const TERMS = ["ワークスペース", "WS", "公開関数", "A&B"];

const SAMPLES: Sample[] = [
  { name: "段落の 1 行", body: "ワークスペースを開く。\n" },
  { name: "段落の複数行", body: "最初の行。\n次の行で WS を開き\n最後の行でワークスペースを閉じる。\n" },
  { name: "リストの項目", body: "- 1 つ目のワークスペース\n  - 入れ子の WS\n1. 番号の公開関数\n" },
  { name: "引用", body: "> 引用の中のワークスペース\n> > 二重の引用の WS\n" },
  { name: "表のセル", body: "| 列 | 列 |\n| --- | --- |\n| WS | ワークスペース と WS |\n" },
  { name: "強調の中", body: "**ワークスペース** と *WS* と ~~公開関数~~\n" },
  { name: "エスケープ", body: "\\*記号\\* の後ろのワークスペース\n" },
  { name: "実体参照", body: "&amp; と &#x30EF; の後ろの WS、A&amp;B\n" },
  { name: "行内のコードが先", body: "`ワークスペース` の後ろのワークスペース\n" },
  { name: "リンクの文字が先", body: "[ワークスペース](./ws.md) の後ろのワークスペース\n" },
  { name: "リンクの URL に綴り", body: "[説明](./WS/公開関数.md) の後ろの WS と公開関数\n" },
  { name: "見出しに綴り", body: "## ワークスペース\n\n本文のワークスペース\n" },
  { name: "字下げの段落", body: "- 項目\n\n   字下げした続きのワークスペース\n" },
  {
    name: "埋め込んだ HTML",
    body: '<!-- html -->\n```html\n<p>HTML の中のワークスペース</p>\n<p><a href="#">ワークスペース</a> の後ろの WS</p>\n```\n<!-- /html -->\n',
  },
  {
    name: "埋め込んだ HTML の実体参照の後ろ",
    body: "<!-- html -->\n```html\n<p>&amp;&lt;b&gt; の後ろのワークスペース</p>\n```\n<!-- /html -->\n",
  },
  {
    name: "flow の定義",
    body: '<!-- flow -->\n```json\n{ "boxes": [{ "id": "a", "name": "{{ワークスペース}} と {{公開関数}}" }] }\n```\n<!-- /flow -->\n',
  },
  {
    name: "flow の定義のエスケープの後ろ",
    body: '<!-- flow -->\n```json\n{ "boxes": [{ "id": "a", "name": "\\"引用\\" と \\u30a2 の後ろの {{ワークスペース}}" }] }\n```\n<!-- /flow -->\n',
  },
  {
    name: "HTML の中の mdmark-flow",
    body: '<!-- html -->\n```html\n<p>前置き</p>\n<mdmark-flow>\n{ "boxes": [{ "id": "a", "name": "{{ワークスペース}}" }] }\n</mdmark-flow>\n```\n<!-- /html -->\n',
  },
];

// ─── 突き合わせ ───

let failures = 0;
for (const sample of SAMPLES) {
  const parsed = parseDocument({ body: sample.body, docId: "sample", defaults: {} });
  const found = [
    ...inlineMatches(sample.body, parsed.tokens, TERMS),
    ...htmlMatches(sample.body, parsed.tokens, TERMS),
    ...diagramMatches(sample.body, parsed.tokens, new Set(["ワークスペース"])),
  ];
  // findWords だけで数えた地の文の一致の数（位置を戻す前）
  let inlineCount = 0;
  forEachInline(parsed.tokens, (inline) => {
    for (const index of matchableChildren(inline)) {
      inlineCount += findWords(inline.children?.[index]?.content ?? "", TERMS).length;
    }
  });
  const lines = sample.body.split("\n");
  const results = found.map((f) => {
    const sliced = (lines[f.position.line - 1] ?? "").slice(f.position.start, f.position.end);
    // 本文の文字が逃がした書き方（実体参照）なら、戻してから比べる
    const ok = sliced === f.word || decodeHTML(sliced) === f.word;
    return { ...f, sliced, ok };
  });
  const countOk = results.filter((r) => r.where === "inline").length === inlineCount;
  const bad = results.filter((r) => !r.ok);
  if (bad.length > 0 || !countOk) {
    failures += 1;
  }
  console.log(`${bad.length === 0 && countOk ? "✅" : "❌"} ${sample.name}（一致 ${results.length} 件 / 地の文の findWords ${inlineCount} 件）`);
  for (const r of results) {
    console.log(`    ${r.ok ? "ok" : "NG"} ${r.where} ${JSON.stringify(r.word)} → ${r.position.line}:${r.position.start}-${r.position.end} ${JSON.stringify(r.sliced)}`);
  }
}
console.log(`\n見本 ${SAMPLES.length} 件 / 不一致 ${failures} 件`);
process.exitCode = failures === 0 ? 0 : 1;
