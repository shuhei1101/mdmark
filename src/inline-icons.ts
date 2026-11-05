import { iconNodeSvg, type MdmarkIconNode } from "./parts/inline-icon.ts";
import { renderNotice } from "./parts/notice.ts";
import { renderSyntaxWarning } from "./parts/syntax-warning.ts";

declare const __MDMARK_LUCIDE_VERSION__: string;

/** 束ねた lucide のバージョン（ビルドと単体テストの `define` で埋める） */
export const LUCIDE_VERSION = __MDMARK_LUCIDE_VERSION__;

/** URL のアイコンのモジュールを読む関数 */
export type ImportIconModule = (url: string) => Promise<unknown>;

/** URL へ `HEAD` を送る関数 */
export type FetchHead = (url: string) => Promise<Response>;

/** 既定のモジュールの読み方: 動的 `import()` */
const importByUrl: ImportIconModule = (url) => import(/* @vite-ignore */ url);

/** 既定の `HEAD` の送り方 */
const fetchHeadByUrl: FetchHead = (url) => fetch(url, { method: "HEAD" });

/** 束ねていない名前のアイコンを読む jsDelivr の URL を返す */
export const lucideIconUrl = (name: string): string =>
  `https://cdn.jsdelivr.net/npm/lucide@${LUCIDE_VERSION}/dist/esm/icons/${name}.mjs`;

/** 読んだモジュールの既定の export が IconNode の形か */
const iconNodeOf = (module: unknown): MdmarkIconNode | undefined => {
  const node = (module as { default?: unknown } | null)?.default;
  return Array.isArray(node) &&
    node.every(
      (item) =>
        Array.isArray(item) &&
        typeof item[0] === "string" &&
        typeof item[1] === "object" &&
        item[1] !== null,
    )
    ? (node as MdmarkIconNode)
    : undefined;
};

/** 読めなかった名前の場所を、書いた文字の行内のコードに戻す */
const revertToCode = (element: HTMLElement, name: string): HTMLElement => {
  const code = document.createElement("code");
  code.textContent = `icon:${name}`;
  element.replaceWith(code);
  return code;
};

/** 要素を含む、描く先の要素の直下のブロックを返す */
const blockOf = (root: HTMLElement, element: Element): Element => {
  let block = element;
  while (block.parentElement && block.parentElement !== root) {
    block = block.parentElement;
  }
  return block;
};

/** 中が空の行内のアイコンの名前ごとに、`icons` に無ければ jsDelivr のモジュールを 1 回だけ読み、svg を同じ名前の全ての場所に入れる。読めない名前は行内のコードに戻し、404 は書き方の警告、それ以外は文書の先頭に知らせの枠を 1 つだけ置く */
export const loadInlineIcons = async (options: {
  /** 描く先の要素 */
  root: HTMLElement;
  /** `opts.icons` */
  icons: Record<string, MdmarkIconNode>;
  /** モジュールを読む関数（既定 `(url) => import(url)`） */
  importModule?: ImportIconModule;
  /** `HEAD` を送る関数（既定 `(url) => fetch(url, { method: "HEAD" })`） */
  fetchHead?: FetchHead;
}): Promise<void> => {
  const {
    root,
    icons,
    importModule = importByUrl,
    fetchHead = fetchHeadByUrl,
  } = options;
  const byName = new Map<string, HTMLElement[]>();
  for (const element of root.querySelectorAll<HTMLElement>(
    "span.mdmark-inline-icon[data-icon]",
  )) {
    const name = element.dataset.icon ?? "";
    if (element.childElementCount > 0 || name === "") {
      continue;
    }
    byName.set(name, [...(byName.get(name) ?? []), element]);
  }
  let offline = false;
  await Promise.all(
    [...byName].map(async ([name, elements]) => {
      let node = Object.hasOwn(icons, name) ? icons[name] : undefined;
      if (node === undefined) {
        try {
          node = iconNodeOf(await importModule(lucideIconUrl(name)));
        } catch {
          node = undefined;
        }
      }
      if (node !== undefined) {
        const svg = iconNodeSvg(node);
        for (const element of elements) {
          element.innerHTML = svg;
        }
        return;
      }
      let notFound = false;
      try {
        notFound = (await fetchHead(lucideIconUrl(name))).status === 404;
      } catch {
        notFound = false;
      }
      for (const element of elements) {
        const code = revertToCode(element, name);
        if (notFound) {
          blockOf(root, code).insertAdjacentHTML(
            "beforebegin",
            renderSyntaxWarning({
              mark: `icon:${name}`,
              message: `の \`${name}\` は Lucide に無いアイコンの名前です。https://lucide.dev/icons/ で名前を確かめてください。書いた文字のまま表示しています。`,
            }),
          );
        }
      }
      if (!notFound) {
        offline = true;
      }
    }),
  );
  if (offline) {
    root.insertAdjacentHTML(
      "afterbegin",
      renderNotice({ name: "lucide", source: "icons" }),
    );
  }
};
