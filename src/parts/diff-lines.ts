import type { DiffBlock, DiffLine } from "../diff/compute.ts";
import { renderDiffHtml } from "./diff-html.ts";
import { escapeHtml } from "./escape.ts";

/** 行頭の印 */
const SIGNS = { same: " ", del: "-", add: "+" };

/** 読み上げにだけ出す、削除した行・追加した行の名前 */
const KIND_NAMES = { del: "削除した行: ", add: "追加した行: " };

/** 変わった語を囲む要素: 削除した側は `del`、追加した側は `ins` */
const WORD_TAGS = { del: "del", add: "ins" };

/** 差分の 1 行の HTML。文字はエスケープし、変わった語は `del`・`ins` で囲む */
function renderLine(line: DiffLine): string {
  const name =
    line.kind === "same"
      ? ""
      : `<span class="mdmark-visually-hidden">${KIND_NAMES[line.kind]}</span>`;
  const text = line.parts
    .map((part) => {
      const escaped = escapeHtml(part.text);
      if (!part.changed || line.kind === "same") {
        return escaped;
      }
      const tag = WORD_TAGS[line.kind];
      return `<${tag} class="mdmark-diff-word">${escaped}</${tag}>`;
    })
    .join("");
  return `<div class="mdmark-diff-line" data-kind="${line.kind}"><span class="mdmark-diff-sign" aria-hidden="true">${SIGNS[line.kind]}</span><span class="mdmark-diff-text">${name}${text}</span></div>`;
}

/** 部品設計『差分の行』: 比べた行を並べた HTML を返す。埋め込んだ HTML の範囲の塊は `renderDiffHtml` で描く */
export function renderDiffLines(options: {
  /** 上から順の塊。埋め込んだ HTML の範囲の `before`・`after` は、スクリプトとイベントの属性を落とした HTML */
  blocks: DiffBlock[];
  /** 埋め込んだ HTML のプレビューの並べ方 */
  sides: "side" | "stack";
  /** プレビューの前と後に出すリビジョンの説明 */
  labels?: { before: string; after: string };
}): string {
  const { blocks, sides, labels = { before: "", after: "" } } = options;
  const body = blocks
    .map((block) => {
      const lines = block.lines.map(renderLine).join("");
      if (block.type === "lines") {
        return lines;
      }
      return renderDiffHtml({
        changed: block.changed,
        sides,
        lines,
        before:
          block.before === null
            ? null
            : { label: labels.before, html: block.before },
        after:
          block.after === null
            ? null
            : { label: labels.after, html: block.after },
      });
    })
    .join("");
  return `<div class="mdmark-diff-lines" role="group" aria-label="変更の行">${body}</div>`;
}
