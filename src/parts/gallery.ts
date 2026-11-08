/** ギャラリーを省いたときの列の数 */
const DEFAULT_COLS = 2;

/** ギャラリーの HTML を返す */
export function renderGallery(options: {
  /** 列の数（既定 2） */
  cols?: number;
  /** 画像の図の並びの HTML（`SLOT_MARKER` を渡せる） */
  body: string;
}): string {
  const { cols = DEFAULT_COLS, body } = options;
  return `<div class="mdmark-gallery" style="--mdmark-gallery-cols: ${cols}"><div class="mdmark-gallery-grid">${body}</div></div>`;
}
