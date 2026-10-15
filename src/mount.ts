import { type MdmarkConfig, resolveConfig } from "./config.ts";
import { attachInteractions } from "./interact/index.ts";
import type { MdmarkIndex } from "./knowledge/index-shape.ts";
import type { MdmarkReferences } from "./knowledge/references.ts";
import { loadLibraries } from "./libraries.ts";
import { attachPrint } from "./print.ts";
import { renderDocument } from "./render/index.ts";

/** `mount` の第 2 引数 */
export type MountOptions = {
  /** 描く Markdown */
  markdown: string;
  /** 使う側の設定。省いたキーには既定を当てる */
  config?: MdmarkConfig;
  /** 索引。省くと索引の用語と関連文書を出さない */
  index?: MdmarkIndex;
  /** 描く文書の索引の `id`。索引に無い `id` は省いたのと同じ */
  docId?: string;
  /** `collectReferences` の戻り値。省くと関連文書の一覧と他の文書の用語集の表の用語を出さない */
  references?: MdmarkReferences;
};

/** `mount` の戻り値 */
export type MountHandle = {
  /** 本文だけを描き直す。設定は `mount` に渡したものを使う。`destroy` の後は何もしない */
  update: (markdown: string) => void;
  /** 要素の中を空にして class `mdmark` を外し、印刷の受け取りを外す。2 回目以降は何もしない */
  destroy: () => void;
};

/** 描く先の要素に付ける class。本文の CSS はこの class の下に当たる */
const ROOT_CLASS = "mdmark";

/** 印刷の機能の名前 */
const PRINT_FEATURE = "print";

/** 描いた要素から、その `MountHandle` を引く。同じ要素への `mount` が前の描画を片付けるのに使う */
const mounted = new WeakMap<HTMLElement, MountHandle>();

/** 要素の中に文書を描き、記法の操作を付け、外部ライブラリと拡張の印を描かせ、印刷の受け取りを付けて、描き直しと片付けの関数を返す */
export function mount(el: HTMLElement, opts: MountOptions): MountHandle {
  // 同じ要素へ 2 回目の mount を呼ぶと、前の描画を先に片付ける
  mounted.get(el)?.destroy();
  const config = resolveConfig({ config: opts.config });
  // 描く世代: 描き直すたびに進め、古い描画の読み込みの結果を捨てるのに使う
  let generation = 0;
  let destroyed = false;
  // 今の文書で決まった機能のオン・オフ
  let features = config.features;
  // 今の文書に付けた記法の操作を外す関数
  let detachInteractions: (() => void) | undefined;

  /** 文書を描く */
  const draw = (markdown: string): void => {
    generation += 1;
    const current = generation;
    detachInteractions?.();
    const rendered = renderDocument({
      markdown,
      config,
      index: opts.index,
      docId: opts.docId,
      references: opts.references,
    });
    el.innerHTML = rendered.html;
    el.classList.add(ROOT_CLASS);
    features = rendered.features;
    detachInteractions = attachInteractions({ root: el, features });
    // 読み込みの完了は待たない
    void loadLibraries({
      root: el,
      libraries: config.libraries,
      isCurrent: () => !destroyed && generation === current,
    });
  };

  draw(opts.markdown);
  const detachPrint = attachPrint({
    root: el,
    isEnabled: () => features[PRINT_FEATURE] === true,
  });
  const handle: MountHandle = {
    update: (markdown) => {
      if (!destroyed) {
        draw(markdown);
      }
    },
    destroy: () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      detachInteractions?.();
      detachPrint();
      el.innerHTML = "";
      el.classList.remove(ROOT_CLASS);
      if (mounted.get(el) === handle) {
        mounted.delete(el);
      }
    },
  };
  mounted.set(el, handle);
  return handle;
}
