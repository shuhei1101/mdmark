import { renderCollapsible } from "./collapsible.ts";

/** フロントマターの表示の折りたたみの見出し */
const FRONTMATTER_TITLE = "フロントマター";

/** 見出し `フロントマター` の閉じた折りたたみに、中身の HTML を入れて返却する。`body` は `SLOT_MARKER` を指定できる */
export const renderFrontmatter = (options: {
  /** 中身の HTML */
  body: string;
  /** 開いた状態から始めるか */
  open?: boolean;
}): string =>
  renderCollapsible({
    title: FRONTMATTER_TITLE,
    open: options.open ?? false,
    body: options.body,
    className: "mdmark-frontmatter",
  });
