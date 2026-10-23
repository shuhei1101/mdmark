/** 動かす行が、見えている範囲の先頭からこの行数以内にあるときは `revealRange` を呼ばない */
export const REVEAL_MARGIN_LINES = 6;

/** `revealLine` で動かした行を覚え、次に届く見えている範囲の知らせが自分の起こしたものかを判定する。時間で捨てない */
export class EditorScrollGuard {
  /** 動かした行 */
  private revealedLine: number | undefined;

  /** 行が見えている範囲の先頭から `REVEAL_MARGIN_LINES` 行以内にあれば `false`（覚えを作らない）、それ以外は行を覚えて `true` */
  shouldReveal(line: number, visibleStart: number): boolean {
    if (line >= visibleStart && line - visibleStart <= REVEAL_MARGIN_LINES) {
      return false;
    }
    this.revealedLine = line;
    return true;
  }

  /** 覚えがあり、見えている範囲がその行を含むなら `false`（送らない）。どちらの場合も覚えを消す。覚えが無ければ `true` */
  takeVisibleRange(range: { start: number; end: number }): boolean {
    const line = this.revealedLine;
    this.revealedLine = undefined;
    if (line === undefined) {
      return true;
    }
    return !(range.start <= line && line <= range.end);
  }
}
