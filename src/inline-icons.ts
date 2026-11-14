import { iconNodeSvg, type MdmarkIconNode } from "./parts/inline-icon.ts";
import { renderNotice } from "./parts/notice.ts";
import { renderSyntaxWarning } from "./parts/syntax-warning.ts";

declare const __MDMARK_LUCIDE_VERSION__: string;

/** まとめた lucide のバージョン（ビルドと単体テストの `define` で埋める） */
export const LUCIDE_VERSION = __MDMARK_LUCIDE_VERSION__;

/** URL のアイコンのモジュールを読み込む関数 */
export type ImportIconModule = (url: string) => Promise<unknown>;

/** URL へ `HEAD` を送信する関数 */
export type FetchHead = (url: string) => Promise<Response>;

/** 既定のモジュールの読み込み方: 動的 `import()` */
const importByUrl: ImportIconModule = (url) => import(/* @vite-ignore */ url);

/** 既定の `HEAD` の送信方法 */
const fetchHeadByUrl: FetchHead = (url) => fetch(url, { method: "HEAD" });

/** まとめていない名前のアイコンを読み込む jsDelivr の URL を返却する */
export const lucideIconUrl = (name: string): string =>
  `https://cdn.jsdelivr.net/npm/lucide@${LUCIDE_VERSION}/dist/esm/icons/${name}.mjs`;

/** 読み込んだモジュールの既定の export が IconNode の構造か */
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

/** 読み込めなかった名前の場所を、記載した文字の行内のコードに戻す */
const revertToCode = (element: HTMLElement, name: string): HTMLElement => {
  const code = document.createElement("code");
  code.textContent = `icon:${name}`;
  element.replaceWith(code);
  return code;
};

/** 要素を含む、描く先の要素の直下のブロックを返却する */
const blockOf = (root: HTMLElement, element: Element): Element => {
  let block = element;
  while (block.parentElement && block.parentElement !== root) {
    block = block.parentElement;
  }
  return block;
};

/** アイコンの名前の描き方。`opts.icons` に無ければ Lucide のモジュールを読み込み、読み込めなければ `undefined` */
async function iconNodeFor(options: {
  name: string;
  icons: Record<string, MdmarkIconNode>;
  importModule: ImportIconModule;
}): Promise<MdmarkIconNode | undefined> {
  const { name, icons, importModule } = options;
  const own = Object.hasOwn(icons, name) ? icons[name] : undefined;
  if (own !== undefined) {
    return own;
  }
  try {
    return iconNodeOf(await importModule(lucideIconUrl(name)));
  } catch {
    return undefined;
  }
}

/** Lucide に無いアイコンの名前か（`HEAD` が 404 を返却したか。送信できなければ偽） */
async function isMissingIcon(
  name: string,
  fetchHead: FetchHead,
): Promise<boolean> {
  try {
    return (await fetchHead(lucideIconUrl(name))).status === 404;
  } catch {
    return false;
  }
}

/** 描けなかったアイコンを記載した文字に戻し、Lucide に無い名前なら、ブロックの前に記載の警告を配置する */
function revertIcons(options: {
  root: HTMLElement;
  name: string;
  elements: HTMLElement[];
  notFound: boolean;
}): void {
  const { root, name, elements, notFound } = options;
  for (const element of elements) {
    const code = revertToCode(element, name);
    if (notFound) {
      blockOf(root, code).insertAdjacentHTML(
        "beforebegin",
        renderSyntaxWarning({
          mark: `icon:${name}`,
          message: `の \`${name}\` は Lucide に無いアイコンの名前です。https://lucide.dev/icons/ で名前を確認してください。記載した文字のまま表示しています。`,
        }),
      );
    }
  }
}

/** 中が空の行内のアイコンの名前ごとに、`icons` に無ければ jsDelivr のモジュールを 1 回だけ読み込み、svg を同じ名前の全ての場所に入れる。読み込めない名前は行内のコードに戻し、404 は記載の警告、それ以外は文書の先頭に通知ブロックを 1 つだけ配置する */
export const loadInlineIcons = async (options: {
  /** 描く先の要素 */
  root: HTMLElement;
  /** `opts.icons` */
  icons: Record<string, MdmarkIconNode>;
  /** 描いた文書がまだ今のものか。`import()`・`HEAD` の後に偽なら DOM に触れずに戻る */
  isCurrent: () => boolean;
  /** モジュールを読み込む関数（既定 `(url) => import(url)`） */
  importModule?: ImportIconModule;
  /** `HEAD` を送信する関数（既定 `(url) => fetch(url, { method: "HEAD" })`） */
  fetchHead?: FetchHead;
}): Promise<void> => {
  const {
    root,
    icons,
    isCurrent,
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
      const node = await iconNodeFor({ name, icons, importModule });
      if (!isCurrent()) {
        return;
      }
      if (node !== undefined) {
        const svg = iconNodeSvg(node);
        for (const element of elements) {
          element.innerHTML = svg;
        }
        return;
      }
      const notFound = await isMissingIcon(name, fetchHead);
      if (!isCurrent()) {
        return;
      }
      revertIcons({ root, name, elements, notFound });
      if (!notFound) {
        offline = true;
        console.error(
          `mdmark: Lucide のアイコンを読み込めません: ${lucideIconUrl(name)}`,
        );
      }
    }),
  );
  if (offline && isCurrent()) {
    root.insertAdjacentHTML(
      "afterbegin",
      renderNotice({ name: "lucide", source: "icons" }),
    );
  }
};
