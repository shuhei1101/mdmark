import type { LibraryEntry } from "./config.ts";
import { renderNotice } from "./parts/notice.ts";

/** `import()` で読んだモジュールが名前付きで export する形 */
export type LibraryModule = {
  /** 印の場所の要素と、印の引数を受けて描く */
  draw: (slot: HTMLElement, args: string[]) => void | Promise<void>;
};

/** URL のモジュールを読む関数 */
export type ImportModule = (url: string) => Promise<LibraryModule>;

/** モジュールが描き終えた印の場所に付ける属性 */
const DRAWN_ATTRIBUTE = "data-mdmark-drawn";

/** 既定のモジュールの読み方: 動的 `import()` */
const importByUrl: ImportModule = (url) => import(/* @vite-ignore */ url);

/** 要素の中の印の場所ごとに、対応表のモジュールを読んで `draw` を呼び、読めない・描けない場所を知らせの枠に替える */
export async function loadLibraries(options: {
  /** 描いた要素 */
  root: HTMLElement;
  /** 既定を当てた対応表 */
  libraries: Record<string, LibraryEntry>;
  /** 描いた文書がまだ今のものか */
  isCurrent: () => boolean;
  /** モジュールを読む関数（単体テストで差し替える） */
  importModule?: ImportModule;
}): Promise<void> {
  const { root, libraries, isCurrent, importModule = importByUrl } = options;
  // 同じ名前のモジュールは、1 回の呼び出しの中で 1 回だけ読む
  const modules = new Map<string, Promise<LibraryModule>>();
  const slots = [...root.querySelectorAll<HTMLElement>("[data-mdmark-slot]")];
  await Promise.all(
    slots.map(async (slot) => {
      const name = slot.getAttribute("data-mdmark-slot") ?? "";
      // 対応表に無い名前は、文書に生の HTML で書かれた要素なので取り除く
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
          loading = importModule(url);
          modules.set(name, loading);
        }
        const { draw } = await loading;
        if (typeof draw !== "function") {
          throw new Error("モジュールが draw を export していない");
        }
        const args = (slot.getAttribute("data-mdmark-args") ?? "")
          .split(/\s+/)
          .filter(Boolean);
        await draw(slot, args);
        // 待っている間に描き直された文書の印の場所には手を付けない
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
        if (slot.isConnected) {
          slot.outerHTML = renderNotice({ name, figure: entry.figure });
        }
      }
    }),
  );
}
