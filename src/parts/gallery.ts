/** ギャラリーを省いたときの列の数 */
const DEFAULT_COLS = 2;

/** ギャラリーの HTML を返却する */
export function renderGallery(options: {
  /** 列の数（既定 2） */
  cols?: number;
  /** 画像の図の並びの HTML（`SLOT_MARKER` を指定できる） */
  body: string;
}): string {
  const { cols = DEFAULT_COLS, body } = options;
  return `<div class="mdmark-gallery" style="--mdmark-gallery-cols: ${cols}"><div class="mdmark-gallery-grid">${body}</div></div>`;
}
