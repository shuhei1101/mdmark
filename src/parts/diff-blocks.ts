/** 色を当てたブロックの class */
const BLOCK_CLASS = "mdmark-diff-block";

/** 種類ごとの、読み上げにだけ出す名前 */
const NAMES = { add: "追加:", del: "削除:" };

/** 種類ごとの、左の余白に置く記号 */
const SIGNS = { add: "+", del: "−" };

/** 行の開始タグ（`li`・`tr`）の、タグ名より後ろの属性 */
const ROW_START_TAG = /^<(li|tr)\b([^>]*)>/;

/** 表の行の 1 つ目のセルの開始タグ */
const FIRST_CELL_START_TAG = /<(?:td|th)\b[^>]*>/;

/** 要素の `data-source-line` と `id`（`data-id` のような別の属性は含めない） */
const LINE_AND_ID = /\s(?:data-source-line|id)="[^"]*"/g;

/** 読み上げの名前と記号の HTML: 名前は見えない文字、記号は読み上げの対象にしない */
function renderMarks(kind: "add" | "del"): string {
  return `<span class="mdmark-visually-hidden">${NAMES[kind]}</span><span class="mdmark-diff-block-sign" aria-hidden="true">${SIGNS[kind]}</span>`;
}

/** 開始タグの属性に、class と `data-kind` を足す */
function addClassAndKind(attributes: string, kind: "add" | "del"): string {
  const withClass = /\sclass="/.test(attributes)
    ? attributes.replace(/(\sclass=")([^"]*)"/, `$1$2 ${BLOCK_CLASS}"`)
    : `${attributes} class="${BLOCK_CLASS}"`;
  return `${withClass} data-kind="${kind}"`;
}

/** 部品設計『差分のブロック』: 描いた文書のブロックを、追加・変更は追加の色、削除は削除の色で示す HTML を返す。`block` は `html` を `div` で包み、`item`・`row` は `html` の `li`・`tr` に class を足す。削除したブロックは中の要素の `data-source-line` と `id` を外す */
export function renderDiffBlock(options: {
  /** 追加・変更したブロックか、削除したブロックか */
  kind: "add" | "del";
  /** `block` は本文のブロック、`item` はリストの項目（`li`）、`row` は表の行（`tr`） */
  unit: "block" | "item" | "row";
  /** 色を当てるブロックの描いた HTML */
  html: string;
}): string {
  const { kind, unit } = options;
  const html =
    kind === "del" ? options.html.replace(LINE_AND_ID, "") : options.html;
  const marks = renderMarks(kind);
  if (unit === "block") {
    return `<div class="${BLOCK_CLASS}" data-kind="${kind}">${marks}${html}</div>`;
  }
  const withStartTag = html.replace(
    ROW_START_TAG,
    (_match, name: string, attributes: string) =>
      `<${name}${addClassAndKind(attributes, kind)}>${unit === "item" ? marks : ""}`,
  );
  if (unit === "item") {
    return withStartTag;
  }
  return withStartTag.replace(
    FIRST_CELL_START_TAG,
    (cell) => `${cell}${marks}`,
  );
}
