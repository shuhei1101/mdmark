/** ステップの HTML を返す。`start` が 1 のときは属性を省く */
export function renderSteps(options: {
  /** 項目の HTML */
  items: string[];
  /** 最初の番号（既定 1） */
  start?: number;
}): string {
  const { items, start = 1 } = options;
  const attribute = start === 1 ? "" : ` start="${start}"`;
  return `<ol class="mdmark-steps"${attribute}>${items.map((item) => `<li>${item}</li>`).join("")}</ol>`;
}
