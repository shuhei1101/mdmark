import {
  MARKDOWN_ATTRIBUTE,
  RAW_ATTRIBUTE,
  renderCodeRaw,
} from "./code-block.part.ts";

/** 描いた結果の中の `id` と、それを指す属性の値の頭に付ける文字。後ろに通し番号と `-` を続ける */
export const PREVIEW_ID_PREFIX = "mdmark-preview-";

/** 描いた結果を描くときに、外の文書でオンでも `false` にする機能 */
export const PREVIEW_CUT_FEATURES = [
  "side-toc",
  "back-to-top",
  "markdown-buttons",
  "backlinks",
  "comments",
  "print",
] as const;

/** 描いた結果の要素に Markdown を描き、片付ける関数を返却する関数 */
export type RenderPreview = (el: HTMLElement, markdown: string) => () => void;

/** ID を指す属性（空白で区切った複数の ID を持てる） */
const ID_REFERENCE_ATTRIBUTES = [
  "aria-controls",
  "aria-labelledby",
  "aria-describedby",
  "for",
] as const;

/** ページで 1 つ持つ通し番号（描いた結果を描くたびに 1 増やす） */
let serial = 0;

/** 描いた結果の中の `id` と、それを指す `href="#…"`・ID を指す属性の値に、`PREVIEW_ID_PREFIX` と通し番号の頭を付ける。描いた結果の外を指す値は書き換えない */
export function prefixPreviewIds(el: HTMLElement, n: number): void {
  const prefix = `${PREVIEW_ID_PREFIX}${n}-`;
  const ids = new Set<string>();
  for (const element of el.querySelectorAll<HTMLElement>("[id]")) {
    ids.add(element.id);
    element.id = `${prefix}${element.id}`;
  }
  const rename = (id: string): string => (ids.has(id) ? `${prefix}${id}` : id);
  for (const link of el.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    const href = link.getAttribute("href") ?? "";
    link.setAttribute("href", `#${rename(decodeURIComponent(href.slice(1)))}`);
  }
  for (const name of ID_REFERENCE_ATTRIBUTES) {
    for (const element of el.querySelectorAll(`[${name}]`)) {
      const value = element.getAttribute(name) ?? "";
      element.setAttribute(name, value.split(/\s+/).map(rename).join(" "));
    }
  }
}

/** コピーのボタンが書き込む文字と同じ、`code` の文字から末尾の改行を 1 つ除いた元の Markdown */
function sourceOf(block: Element): string {
  return (block.querySelector("pre > code")?.textContent ?? "").replace(
    /\n$/,
    "",
  );
}

/** 1 つのコードブロックの描いた結果と Raw のボタン */
type Preview = {
  block: HTMLElement;
  pre: HTMLElement;
  preview: HTMLElement;
  button: HTMLButtonElement;
  cleanup: (() => void) | undefined;
};

/** 描いた結果と Raw のボタンを取り除き、`pre` を出す */
function removePreview(item: Preview): void {
  item.cleanup?.();
  item.cleanup = undefined;
  item.preview.remove();
  item.button.remove();
  item.pre.hidden = false;
}

/** 描いた結果の要素に中身を描き、`id` の頭を付ける。描けなければ描いた結果と Raw のボタンを取り除いて `false` を返却する */
function renderInto(item: Preview, renderPreview: RenderPreview): boolean {
  try {
    item.cleanup = renderPreview(item.preview, sourceOf(item.block));
  } catch {
    removePreview(item);
    return false;
  }
  serial += 1;
  prefixPreviewIds(item.preview, serial);
  return true;
}

/** 描いた結果と `pre` の表示をそろえ、`aria-pressed` を元の Markdown を出しているかに合わせる */
function show(item: Preview, raw: boolean): void {
  item.pre.hidden = !raw;
  item.preview.hidden = raw;
  item.button.setAttribute("aria-pressed", String(raw));
}

/** コードブロックの `pre` の後ろに描いた結果の要素を、帯の右の塊の先頭に Raw のボタンを配置する */
function placePreview(block: HTMLElement, raw: boolean): Preview | undefined {
  const pre = block.querySelector<HTMLElement>(":scope > pre");
  const bar = block.querySelector<HTMLElement>(":scope > .mdmark-code-bar");
  if (!pre || !bar) {
    return undefined;
  }
  const preview = document.createElement("div");
  preview.className = "mdmark-code-preview";
  pre.after(preview);
  const meta = bar.querySelector<HTMLElement>(".mdmark-code-meta") ?? bar;
  meta.insertAdjacentHTML("afterbegin", renderCodeRaw({ pressed: raw }));
  const button = meta.querySelector<HTMLButtonElement>(".mdmark-code-raw");
  if (!button) {
    preview.remove();
    return undefined;
  }
  return { block, pre, preview, button, cleanup: undefined };
}

/** `data-mdmark-markdown` を持つコードブロックに描いた結果と Raw のボタンを付け、押すたびに描いた結果と元の Markdown を切り替える。描いた結果とボタンを取り除く関数を返却する */
export function attachCodePreviews(
  root: HTMLElement,
  renderPreview: RenderPreview,
): () => void {
  const blocks = [
    ...root.querySelectorAll<HTMLElement>(
      `.mdmark-code[${MARKDOWN_ATTRIBUTE}]`,
    ),
  ].filter((block) => {
    const outer = block.parentElement?.closest(".mdmark-code-preview");
    return !outer || outer === root || !root.contains(outer);
  });
  const items: Preview[] = [];
  for (const block of blocks) {
    const raw = block.hasAttribute(RAW_ATTRIBUTE);
    const item = placePreview(block, raw);
    if (!item) {
      continue;
    }
    if (!raw && !renderInto(item, renderPreview)) {
      continue;
    }
    show(item, raw);
    items.push(item);
  }
  const onClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const item = items.find((candidate) => candidate.button.contains(target));
    if (!item) {
      return;
    }
    const raw = item.button.getAttribute("aria-pressed") !== "true";
    if (
      !raw &&
      item.cleanup === undefined &&
      !renderInto(item, renderPreview)
    ) {
      return;
    }
    show(item, raw);
  };
  root.addEventListener("click", onClick);
  return () => {
    root.removeEventListener("click", onClick);
    for (const item of items) {
      removePreview(item);
    }
  };
}
