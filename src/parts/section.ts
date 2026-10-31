import { escapeHtml } from "./escape.ts";

/** 見出しの中身の HTML から、タグを除いた文字を取り出す */
function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/** 節（見出しとその中身）の HTML を返す。`toggle` が `false` のときは開閉のボタンを置かず中身を隠さない */
export function renderSection(options: {
  /** 見出しの階層 */
  level: 1 | 2 | 3 | 4;
  /** 見出しの ID。中身の `id` を `section-{id}` にする */
  id: string;
  /** 見出しの中身の HTML */
  title: string;
  /** 中身が開いているか（既定 `true`） */
  open?: boolean;
  /** 開閉のボタンを付けるか（既定 `true`） */
  toggle?: boolean;
  /** 見出しに ID へのアンカーを付けるか（既定 `true`） */
  anchor?: boolean;
  /** 中身の HTML（`SLOT_MARKER` を渡せる） */
  body: string;
}): string {
  const {
    level,
    id,
    title,
    open = true,
    toggle = true,
    anchor = true,
    body,
  } = options;
  const escapedId = escapeHtml(id);
  const heading = toggle
    ? `<button class="mdmark-section-toggle" type="button" aria-expanded="${open}" aria-controls="section-${escapedId}">${title}</button>`
    : title;
  const anchorHtml = anchor
    ? `<a class="mdmark-anchor" href="#${escapedId}" aria-label="「${plainText(title)}」へのリンク"></a>`
    : "";
  const hidden = toggle && !open ? ' hidden="until-found"' : "";
  return `<h${level} class="mdmark-heading" id="${escapedId}">${heading}${anchorHtml}</h${level}><div class="mdmark-section-body" id="section-${escapedId}" data-section="${open ? "open" : "closed"}"${hidden}>${body}</div>`;
}
