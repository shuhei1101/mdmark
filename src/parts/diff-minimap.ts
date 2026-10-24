/** 帯に置く印: 種類と、送り先の全体に対する 0〜1 の割合の位置と長さ */
export type DiffMinimapMark = {
  kind: "del" | "add";
  top: number;
  height: number;
};

/** 割合を `style` の % の文字にする。小数の誤差は丸める */
function percent(ratio: number): string {
  return `${Number((ratio * 100).toFixed(4))}%`;
}

/** 位置と長さを持つ `style` の値 */
function box(position: { top: number; height: number }): string {
  return `top: ${percent(position.top)}; height: ${percent(position.height)}`;
}

/** 部品設計『ミニマップ』: 削除した行と追加した行の位置の印と、今見えている範囲の枠を持つ縦の帯の HTML を返す */
export function renderDiffMinimap(options: {
  /** 印。続いた同じ種類の行は 1 つにまとめて渡す */
  marks: DiffMinimapMark[];
  /** 今見えている範囲 */
  view: { top: number; height: number };
}): string {
  const { marks, view } = options;
  const items = marks
    .map(
      (mark) =>
        `<div class="mdmark-diff-minimap-mark" data-kind="${mark.kind}" style="${box(mark)}"></div>`,
    )
    .join("");
  return `<div class="mdmark-diff-minimap" aria-hidden="true">${items}<div class="mdmark-diff-minimap-view" style="${box(view)}"></div></div>`;
}
