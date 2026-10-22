import type { DiffRevision } from "../diff/source.ts";
import { escapeHtml } from "./escape.ts";
import { iconSvg } from "./icons.ts";

/** 日時の表示: 日本時間の `2026/10/19 16:40` */
const DATE_FORMAT = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** リビジョンの説明: 日時（日本時間）に `label` と `author` を続ける */
export function describeRevision(revision: DiffRevision): string {
  const label =
    revision.label === undefined || revision.label === ""
      ? ""
      : ` ${revision.label}`;
  const author =
    revision.author === undefined || revision.author === ""
      ? ""
      : `（${revision.author}）`;
  return `${DATE_FORMAT.format(new Date(revision.at))}${label}${author}`;
}

/** 選ぶ欄の選択肢を並べる。`disabled` の位置は選べなくする */
function renderOptions(options: {
  revisions: DiffRevision[];
  selected: string;
  disabledFrom?: number;
  disabledAt?: number;
}): string {
  const { revisions, selected, disabledFrom, disabledAt } = options;
  return revisions
    .map((revision, position) => {
      const disabled =
        position === disabledAt ||
        (disabledFrom !== undefined && position >= disabledFrom);
      return `<option value="${escapeHtml(revision.id)}"${revision.id === selected ? " selected" : ""}${disabled ? " disabled" : ""}>${escapeHtml(describeRevision(revision))}</option>`;
    })
    .join("");
}

/** 部品設計『リビジョンの選択』: 前と後のリビジョンを選ぶ 2 つの欄と、削除した行と追加した行の数の文の HTML を返す。前の欄では一番新しいリビジョンを、後の欄では前に選んだもの以前のリビジョンを選べなくする */
export function renderRevisionPicker(options: {
  /** 新しい順のリビジョン */
  revisions: DiffRevision[];
  /** 前の欄で選んだリビジョンの `id` */
  before: string;
  /** 後の欄で選んだリビジョンの `id` */
  after: string;
  /** 削除した行と追加した行の数。省くと数の文を空にする */
  counts?: { del: number; add: number };
  /** `label` と `select` を結ぶ `id` の頭 */
  idPrefix: string;
}): string {
  const { revisions, before, after, counts, idPrefix } = options;
  const prefix = escapeHtml(idPrefix);
  const beforeIndex = revisions.findIndex((revision) => revision.id === before);
  const summary =
    counts === undefined
      ? ""
      : `削除した行 ${counts.del}・追加した行 ${counts.add}`;
  return `<div class="mdmark-diff-picker"><div class="mdmark-diff-field"><label for="${prefix}-before">前のリビジョン</label><select id="${prefix}-before">${renderOptions({ revisions, selected: before, disabledAt: 0 })}</select></div><span class="mdmark-diff-arrow" aria-hidden="true">${iconSvg("arrow-right")}</span><div class="mdmark-diff-field"><label for="${prefix}-after">後のリビジョン</label><select id="${prefix}-after">${renderOptions({ revisions, selected: after, disabledFrom: beforeIndex })}</select></div></div><div class="mdmark-diff-summary" role="status">${summary}</div>`;
}
