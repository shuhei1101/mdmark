import type { LibraryEntry } from "./config.ts";
import {
  extensionFor,
  type MdmarkExtension,
  type MdmarkExtensionModule,
  type MdmarkMarkArgs,
  validateMarkArgs,
} from "./extensions.ts";
import { renderNotice } from "./parts/notice.ts";
import { renderSyntaxWarning } from "./parts/syntax-warning.ts";
import { parseMarkArgs } from "./render/marks.ts";

/** `import()` で読み込んだモジュールが名前付きで export する構造 */
export type LibraryModule = {
  /** マーカーの場所の要素と、マーカーの引数を受けて描く */
  draw: (slot: HTMLElement, args: string[]) => void | Promise<void>;
};

/** URL のモジュールを読み込む関数 */
export type ImportModule = (url: string) => Promise<LibraryModule>;

/** モジュールが描き終えたマーカーの場所に付ける属性 */
const DRAWN_ATTRIBUTE = "data-mdmark-drawn";

/** `setEmbeddedLibraries` が入れる、マーカーの名前から外部ライブラリのモジュールを返却する関数を参照する表。無ければ対応表の URL から読み込む。ページの中の全ての `mount` に有効になる */
export let embeddedLibraries:
  | Record<string, () => Promise<LibraryModule>>
  | undefined;

/** 埋めた外部ライブラリを置き換える。`undefined` で対応表の URL から読み込む構造に戻す */
export function setEmbeddedLibraries(
  loaders: Record<string, () => Promise<LibraryModule>> | undefined,
): void {
  embeddedLibraries = loaders;
}

/** 既定のモジュールの読み込み方: 動的 `import()` */
const importByUrl: ImportModule = (url) => import(/* @vite-ignore */ url);

/** 要素の中のマーカーの場所ごとに、登録した拡張なら引数を検査して `load` で、対応表なら URL でモジュールを読み込んで `draw` を呼ぶ。引数が合わない場所は記載の警告に、読み込めない・描けない・検査が失敗する場所は通知ブロックに替える */
export async function loadLibraries(options: {
  /** 描いた要素 */
  root: HTMLElement;
  /** 既定を適用した対応表 */
  libraries: Record<string, LibraryEntry>;
  /** 描いた文書がまだ今のものか */
  isCurrent: () => boolean;
  /** モジュールを読み込む関数（単体テストで差し替える） */
  importModule?: ImportModule;
  /** 範囲で記載した拡張のマーカーから読み込んだ部品の定義。マーカーの場所の `data-mdmark-definition` の番号で参照する */
  definitions?: unknown[];
}): Promise<void> {
  const {
    root,
    libraries,
    isCurrent,
    importModule = importByUrl,
    definitions = [],
  } = options;
  // 同じ名前のモジュールは、1 回の呼び出しの中で 1 回だけ読み込む
  const modules = new Map<string, Promise<LibraryModule>>();
  const extensionModules = new Map<string, Promise<MdmarkExtensionModule>>();
  const slots = [...root.querySelectorAll<HTMLElement>("[data-mdmark-slot]")];
  await Promise.all(
    slots.map(async (slot) => {
      const name = slot.getAttribute("data-mdmark-slot") ?? "";
      const argsText = slot.getAttribute("data-mdmark-args") ?? "";
      // 設定の対応表より登録した拡張を優先する
      const extension = extensionFor(name);
      if (extension) {
        await drawExtension({ slot, root, extension, argsText });
        return;
      }
      // 対応表に無い名前は、文書に生の HTML で記載された要素なので取り除く
      const entry = Object.hasOwn(libraries, name)
        ? libraries[name]
        : undefined;
      if (!entry) {
        slot.remove();
        return;
      }
      const url = new URL(entry.url, document.baseURI).href;
      try {
        let loading = modules.get(name);
        if (!loading) {
          // 埋めた外部ライブラリがあれば URL を読み込まない。表に無い名前は埋めていないものとして通知ブロックにする
          const embedded = embeddedLibraries;
          const loader =
            embedded && Object.hasOwn(embedded, name)
              ? embedded[name]
              : undefined;
          loading = embedded
            ? loader
              ? loader()
              : Promise.reject(new Error(`埋めていない: ${name}`))
            : importModule(url);
          modules.set(name, loading);
        }
        const { draw } = await loading;
        if (typeof draw !== "function") {
          throw new Error("モジュールが draw を export していない");
        }
        await draw(slot, argsText.split(/\s+/).filter(Boolean));
        // 待っている間に再描画された文書のマーカーの場所には手を付けない
        if (!isCurrent()) {
          return;
        }
        slot.removeAttribute("role");
        slot.setAttribute(DRAWN_ATTRIBUTE, "");
      } catch (error) {
        if (!isCurrent()) {
          return;
        }
        console.error("外部ライブラリを読み込めない", name, url, error);
        // `draw` が要素を取り除いていたら、替える先が無い
        if (root.contains(slot)) {
          slot.outerHTML = renderNotice({ name, figure: entry.figure });
        }
      }
    }),
  );

  /** 拡張のマーカーの場所 1 つを描かせる: 引数を検査し、合えば `load` で読み込んで `draw` を呼ぶ */
  async function drawExtension(target: {
    slot: HTMLElement;
    root: HTMLElement;
    extension: MdmarkExtension;
    argsText: string;
  }): Promise<void> {
    const { slot, extension, argsText } = target;
    const value: MdmarkMarkArgs = parseMarkArgs(argsText);
    // 範囲で記載したマーカーだけが部品の定義を持つ
    const definitionIndex = slot.getAttribute("data-mdmark-definition");
    if (definitionIndex !== null && Number(definitionIndex) in definitions) {
      value.definition = definitions[Number(definitionIndex)];
    }
    try {
      if (extension.schema) {
        const items = await validateMarkArgs(extension.schema, value);
        if (items.length > 0) {
          if (isCurrent() && root.contains(slot)) {
            slot.outerHTML = renderSyntaxWarning({
              mark: `<!-- ${extension.directive}${argsText ? `: ${argsText}` : ""} -->`,
              message: `の引数が、拡張 \`${extension.name}\` の決まりに合いません。修正してから再読み込みしてください。`,
              items,
            });
          }
          return;
        }
      }
      let loading = extensionModules.get(extension.directive);
      if (!loading) {
        loading = extension.load();
        extensionModules.set(extension.directive, loading);
      }
      const { draw } = await loading;
      if (typeof draw !== "function") {
        throw new Error("モジュールが draw を export していない");
      }
      await draw(slot, value);
      if (!isCurrent()) {
        return;
      }
      slot.removeAttribute("role");
      slot.setAttribute(DRAWN_ATTRIBUTE, "");
    } catch (error) {
      if (!isCurrent()) {
        return;
      }
      console.error("拡張を読み込めない", extension.name, error);
      if (root.contains(slot)) {
        slot.outerHTML = renderNotice({
          name: extension.name,
          source: "extension",
        });
      }
    }
  }
}
