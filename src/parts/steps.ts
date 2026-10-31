import { renderCollapsible } from "./collapsible.ts";

/** ステップの HTML を返す。`start` が 1 のときは属性を省く。`collapse` が `closed`・`open` なら、折り畳みに入れる */
export function renderSteps(options: {
  /** 項目の HTML */
  items: string[];
  /** 最初の番号（既定 1） */
  start?: number;
  /** 折り畳みに入れるかと既定の開閉（既定 `none`） */
  collapse?: "none" | "closed" | "open";
  /** 折り畳みの見出し（既定は `手順（{項目の数} ステップ）`） */
  title?: string;
}): string {
  const { items, start = 1, collapse = "none", title } = options;
  const attribute = start === 1 ? "" : ` start="${start}"`;
  const list = `<ol class="mdmark-steps"${attribute}>${items.map((item) => `<li>${item}</li>`).join("")}</ol>`;
  if (collapse === "none") {
    return list;
  }
  return renderCollapsible({
    title: title ?? `手順（${items.length} ステップ）`,
    open: collapse === "open",
    body: list,
  });
}
