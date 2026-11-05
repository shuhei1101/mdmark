/** 段組みの HTML を返す。列ごとの中身は `SLOT_MARKER` を渡せる */
export const renderLayoutColumns = (options: {
  /** 列ごとの中身の HTML */
  columns: string[];
}): string => {
  const columns = options.columns
    .map((column) => `<div class="mdmark-layout-column">${column}</div>`)
    .join("");
  return `<div class="mdmark-layout-columns" data-count="${options.columns.length}">${columns}</div>`;
};
