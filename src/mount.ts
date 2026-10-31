import type { MdmarkCommentStore } from "./comments/spec.ts";
import {
  type MdmarkConfig,
  type ResolvedConfig,
  resolveConfig,
} from "./config.ts";
import { colorDiffBlocks, loadDiffPair } from "./diff/blocks.ts";
import {
  attachDiff,
  createSegmenter,
  type DiffHtmlRenderer,
} from "./diff/panel.ts";
import {
  type DiffMode,
  type DiffSource,
  normalizeDiffMode,
} from "./diff/source.ts";
import { highlightCodeBlocks } from "./highlight.ts";
import { attachInteractions } from "./interact/index.ts";
import { attachSideToc, type SideTocState } from "./interact/side-toc.ts";
import type { MdmarkAlias } from "./knowledge/aliases.ts";
import type { MdmarkIndex } from "./knowledge/index-shape.ts";
import type { MdmarkReferences } from "./knowledge/references.ts";
import { loadLibraries } from "./libraries.ts";
import { attachParts } from "./mount-parts.ts";
import { renderNotice } from "./parts/notice.ts";
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
  /** `collectReferences` の戻り値。省くと、関連文書の一覧は索引の `related` だけから出し、他の文書の用語集の表の用語を照合しない */
  references?: MdmarkReferences;
  /** `buildAliases` が作ったエイリアス。`glossary` がオンのとき、名前と別名に下線と種類ごとのツールチップを付ける。使えないエイリアス（`env` を含む）は照合せず、知らせの枠も出さない */
  aliases?: MdmarkAlias[];
  /** 差分の取り出し元。渡すと描いた文書に差分を開く UI を付ける。渡すときは `docId` も要る */
  diffSource?: DiffSource;
  /** 差分の出し方。`button`（既定）は「変更を見る」を押してから差分の行を出し、`open` は描いた時点で押した状態にし、`blocks` は描いた文書のブロックを追加と削除の色で塗り分ける。`diffSource` を渡さないときは使わない。知らない値は `button` にする */
  diffMode?: DiffMode;
  /** コメントの読み書きの関数。`comments` の機能がオンのときだけ使う。渡すときは `docId` も要る */
  commentStore?: MdmarkCommentStore;
};

/** `mount` の戻り値 */
export type MountHandle = {
  /** 本文だけを描き直す。設定は `mount` に渡したものを使う。`destroy` の後は何もしない */
  update: (markdown: string) => void;
  /** 要素の中を空にして class `mdmark` とテーマの属性を外し、印刷の受け取りを外す。2 回目以降は何もしない */
  destroy: () => void;
};

/** 描く先の要素に付ける class。本文の CSS はこの class の下に当たる */
const ROOT_CLASS = "mdmark";

/** 描く先の要素に、既定を当てた設定の `colorTheme` を値にして付ける属性。`src/index.css` は `:root:has()` でこの属性を見て、テーマの配色の値を `:root` に当てる */
const COLOR_THEME_ATTRIBUTE = "data-mdmark-color-theme";

/** 印刷の機能の名前 */
const PRINT_FEATURE = "print";

/** 描いた要素から、その `MountHandle` を引く。同じ要素への `mount` が前の描画を片付けるのに使う */
const mounted = new WeakMap<HTMLElement, MountHandle>();

/** 差分のプレビューに出す埋め込んだ HTML の範囲を、文書に描くときと同じ描き方で描く関数を作る: 範囲の HTML を `html` のコードブロックに入れ `<!-- html -->` で囲んだ Markdown を文書を描く処理に通し、得た枠の中身と、置いた要素にその描画の機能のオン・オフと操作できる部品の定義で記法の操作を付ける関数を返す。`html` の機能がオフのときは枠が無く、空の文字と何もしない関数を返す */
function createDiffHtmlRenderer(options: {
  config: ResolvedConfig;
  opts: MountOptions;
}): DiffHtmlRenderer {
  const { config, opts } = options;
  return (html) => {
    const markdown = [
      "<!-- html -->",
      "",
      "```html",
      html,
      "```",
      "",
      "<!-- /html -->",
      "",
    ].join("\n");
    const rendered = renderDocument({
      markdown,
      config,
      index: opts.index,
      docId: opts.docId,
      references: opts.references,
      aliases: opts.aliases,
    });
    const template = document.createElement("template");
    template.innerHTML = rendered.html;
    return {
      html: template.content.querySelector(".mdmark-html")?.innerHTML ?? "",
      attach: (root) =>
        attachInteractions({
          root,
          features: rendered.features,
          paramDefinitions: rendered.paramDefinitions,
          placement: config.tooltips.placement,
        }),
    };
  };
}

/** HTML 文字列から要素を 1 つ作る */
function parseElement(html: string): HTMLElement {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.firstElementChild as HTMLElement;
}

/** 後の文書を描いた HTML を、前の文書と比べて追加と削除の色を当てた中身にする。前の文書は `render` で同じ引数で描く */
function drawColoredBlocks(options: {
  /** 後の文書を描いた HTML */
  rendered: string;
  /** 後の Markdown */
  after: string;
  /** 前の Markdown */
  before: string;
  /** Markdown を同じ引数で描いた HTML にする関数 */
  render: (markdown: string) => string;
}): DocumentFragment {
  const afterTemplate = document.createElement("template");
  afterTemplate.innerHTML = options.rendered;
  const beforeTemplate = document.createElement("template");
  beforeTemplate.innerHTML = options.render(options.before);
  colorDiffBlocks({
    before: { root: beforeTemplate.content, markdown: options.before },
    after: { root: afterTemplate.content, markdown: options.after },
    segmenter: createSegmenter(),
  });
  return afterTemplate.content;
}

/** 要素の中に文書を描き、記法の操作を付け、外部ライブラリと拡張の印を描かせ、ビューとコメントの部品を付け、印刷の受け取りを付けて、描き直しと片付けの関数を返す。`diffSource` か `commentStore` を渡して `docId` が無いとき、`commentStore` が `load`・`save` の関数を持たないときは、何も描かずに `TypeError` を投げる */
export function mount(el: HTMLElement, opts: MountOptions): MountHandle {
  const { diffSource, commentStore, docId } = opts;
  if (diffSource !== undefined && docId === undefined) {
    throw new TypeError("diffSource を渡すときは docId も渡してください");
  }
  if (commentStore !== undefined) {
    if (docId === undefined) {
      throw new TypeError("commentStore を渡すときは docId も渡してください");
    }
    if (
      typeof commentStore.load !== "function" ||
      typeof commentStore.save !== "function"
    ) {
      throw new TypeError(
        "commentStore は load と save の関数を持つオブジェクトで渡してください",
      );
    }
  }
  // 同じ要素へ 2 回目の mount を呼ぶと、前の描画を先に片付ける
  mounted.get(el)?.destroy();
  const diffMode = normalizeDiffMode(opts.diffMode);
  const config = resolveConfig({ config: opts.config });
  const renderDiffHtml = createDiffHtmlRenderer({ config, opts });
  // 描く世代: 描き直すたびに進め、古い描画の読み込みの結果を捨てるのに使う
  let generation = 0;
  let destroyed = false;
  // 今の文書で決まった機能のオン・オフ
  let features = config.features;
  // 今の文書に付けた記法の操作を外す関数
  let detachInteractions: (() => void) | undefined;
  // 今の文書に付けた差分を外す関数
  let detachDiff: (() => void) | undefined;
  // 今の文書に付けたビューとコメントの部品を外す関数
  let detachParts: (() => void) | undefined;
  // 今の文書に付けた右側の目次を外す関数
  let detachSideToc: (() => void) | undefined;
  // 右側の目次の状態（`mount` ごとに 1 つ。描き直しでも保つ）
  const sideTocState: SideTocState = { open: false, pinned: false };
  // 色分けのライブラリのモジュールの控え（`mount` ごとに 1 つ。描き直しでは読み直さない）
  const syntaxModules = new Map<string, Promise<{ default?: unknown }>>();
  // コメントの機能に読み書きの関数が要ることを出したか（`mount` ごとに 1 回だけ出す）
  const warned = { missingStore: false };

  /** 文書を描く。`coloredFrom` は `blocks` で色分けするときの前の Markdown（`markdown` が後） */
  const draw = (markdown: string, coloredFrom?: string): void => {
    generation += 1;
    const current = generation;
    detachInteractions?.();
    detachSideToc?.();
    detachSideToc = undefined;
    detachDiff?.();
    detachDiff = undefined;
    detachParts?.();
    detachParts = undefined;
    const rendered = renderDocument({
      markdown,
      config,
      index: opts.index,
      docId: opts.docId,
      references: opts.references,
      aliases: opts.aliases,
    });
    if (coloredFrom === undefined) {
      el.innerHTML = rendered.html;
    } else {
      el.replaceChildren(
        drawColoredBlocks({
          rendered: rendered.html,
          after: markdown,
          before: coloredFrom,
          render: (source) =>
            renderDocument({
              markdown: source,
              config,
              index: opts.index,
              docId: opts.docId,
              references: opts.references,
              aliases: opts.aliases,
            }).html,
        }),
      );
    }
    el.classList.add(ROOT_CLASS);
    el.setAttribute(COLOR_THEME_ATTRIBUTE, config.colorTheme);
    features = rendered.features;
    // 右側の目次を付けたときは、以降の操作と部品を本文の列に付ける
    let body = el;
    let aside: HTMLElement | undefined;
    if (features["side-toc"] === true) {
      const sideToc = attachSideToc({
        el,
        mode: config.sideToc.mode,
        sections: features.sections === true,
        state: sideTocState,
      });
      body = sideToc.content;
      aside = sideToc.aside;
      detachSideToc = sideToc.detach;
    }
    detachInteractions = attachInteractions({
      root: body,
      features,
      paramDefinitions: rendered.paramDefinitions,
      placement: config.tooltips.placement,
    });
    // 読み込みの完了は待たない
    void loadLibraries({
      root: body,
      libraries: config.libraries,
      isCurrent: () => !destroyed && generation === current,
      definitions: rendered.extensionDefinitions,
    });
    // 色分けの対象があるときだけ読む。読み込みの完了は待たない
    void highlightCodeBlocks({
      root: body,
      url: config.syntax.url,
      isCurrent: () => !destroyed && generation === current,
      modules: syntaxModules,
    });
    detachParts = attachParts({
      root: body,
      features,
      commentStore,
      docId,
      isCurrent: () => !destroyed && generation === current,
      warned,
    });
    if (diffSource !== undefined && docId !== undefined) {
      if (diffMode !== "blocks") {
        detachDiff = attachDiff({
          root: body,
          source: diffSource,
          docId,
          renderHtml: renderDiffHtml,
          hideWith: aside ? [aside] : [],
          open: diffMode === "open",
        });
      } else if (coloredFrom === undefined) {
        // 色分けせずに描いたときだけ、比べる 2 つの本文を取り出す。取り出しの完了は待たない
        void loadDiffPair({ source: diffSource, docId }).then((pair) => {
          if (destroyed || generation !== current) {
            return;
          }
          if (pair.kind === "pair" && pair.before !== pair.after) {
            draw(pair.after, pair.before);
          } else if (pair.kind === "failed") {
            body.prepend(
              parseElement(
                renderNotice({ name: docId, source: "diff-blocks" }),
              ),
            );
          }
        });
      }
    }
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
      detachSideToc?.();
      detachDiff?.();
      detachParts?.();
      detachPrint();
      el.innerHTML = "";
      el.classList.remove(ROOT_CLASS);
      el.removeAttribute(COLOR_THEME_ATTRIBUTE);
      if (mounted.get(el) === handle) {
        mounted.delete(el);
      }
    },
  };
  mounted.set(el, handle);
  return handle;
}
