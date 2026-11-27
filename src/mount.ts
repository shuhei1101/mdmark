import {
  attachCodePreviews,
  PREVIEW_CUT_FEATURES,
} from "./code-block/code-preview.interact.ts";
import { checkCommentStore, type MdmarkCommentStore } from "./comments/spec.ts";
import {
  applyPageSettings,
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
import { runHtmlScripts, type Transpiler } from "./html-scripts.ts";
import { loadInlineIcons } from "./inline-icons.ts";
import { attachInteractions } from "./interact.ts";
import type { MdmarkAlias } from "./knowledge/aliases.ts";
import type { MdmarkIndex } from "./knowledge/index-shape.ts";
import type { MdmarkReferences } from "./knowledge/references.ts";
import { embeddedLibraries, loadLibraries } from "./libraries.ts";
import {
  type PureMarkdownResult,
  toPureMarkdown,
} from "./markdown/pure-markdown.ts";
import { attachMermaid } from "./mermaid.ts";
import { attachParts, type PartsHandle } from "./mount-parts.ts";
import { attachPrint } from "./print.ts";
import { renderDocument } from "./render/index.ts";
import type { ResolveIdLink } from "./render/sanitize.ts";
import { attachBackToTop } from "./section/back-to-top.interact.ts";
import type { SectionStates } from "./section/section.interact.ts";
import {
  attachSideToc,
  type SideTocState,
} from "./section/side-toc.interact.ts";
import type { MdmarkIconNode } from "./shared/icon-node.logic.ts";
import { renderNotice } from "./shared/notice.part.ts";
import type { PartStates } from "./shared/part-states.interact.ts";

/** `mount` の `rendered` に指定する、`renderDocument` の戻り値のうち `mount` が使用する項目 */
export type MdmarkRendered = Pick<
  RenderedDocument,
  "html" | "features" | "page" | "paramDefinitions" | "extensionDefinitions"
>;

/** `mount` の第 2 引数 */
export type MountOptions = {
  /** 描く Markdown。`rendered` を指定しないとき必須 */
  markdown?: string;
  /** 書き出しが `render` と同じ処理で描いた結果。指定すると Markdown を描かず、その HTML を要素に入れて操作を付ける。`html` はもう一度サニタイズしない */
  rendered?: MdmarkRendered;
  /** `rendered` で描いた文書の Markdown のコピーとエクスポートのボタンが使用する純粋な Markdown。省くとボタンを配置しない */
  pureMarkdown?: string;
  /** 描く文書の、設定ファイルのフォルダからの相対パス（`render` の `path` と同じ） */
  path?: string;
  /** 利用側の設定。省いたキーには既定を適用する */
  config?: MdmarkConfig;
  /** 索引。省くと索引の用語と関連文書を出さない */
  index?: MdmarkIndex;
  /** 描く文書の索引の `id`。索引に無い `id` は省いたのと同じ */
  docId?: string;
  /** `collectReferences` の戻り値。省くと、関連文書の一覧は索引の `related` だけから出し、他の文書の用語集の表の用語を照合しない */
  references?: MdmarkReferences;
  /** `buildAliases` が作ったエイリアス。`glossary` がオンのとき、名前と別名に下線と種類ごとのツールチップを付ける。使用できないエイリアス（`env` を含む）は照合せず、通知ブロックも出さない */
  aliases?: MdmarkAlias[];
  /** 差分の取り出し元。指定すると描いた文書に差分を開く UI を付ける。指定するときは `docId` も要る */
  diffSource?: DiffSource;
  /** 差分の出し方。`button`（既定）は「変更表示」を押してから差分の行を出し、`open` は描いた時点で押した状態にし、`blocks` は描いた文書のブロックを追加と削除の色で塗り分け、`side-by-side` は「変更表示」を押してから前と後を描いた本文を左右に並べる。`diffSource` を指定しないときは使用しない。知らない値は `button` にする */
  diffMode?: DiffMode;
  /** 「変更表示」のボタンとリビジョンの選択を配置するか（既定 `true`）。`false` のときは配置せず、描いた時点で一番新しいリビジョンとその 1 つ前の差分を出す。真偽値でない値は `true` にする。`diffSource` を指定しないときと `diffMode` が `blocks` のときは使用しない */
  diffControls?: boolean;
  /** コメントの読み込みと保存の関数。`comments` の機能がオンのときだけ使用する。指定するときは `docId` も要る */
  commentStore?: MdmarkCommentStore;
  /** 比較元の Markdown。指定すると、本文の中で比較元から変えたブロックを `blocks` と同じ色で塗り分ける。`null` と省いたときは色分けしない */
  baseMarkdown?: string | null;
  /** `+columns` の表で列の表示を切り替えるたびに呼ぶ */
  onColumnsChange?: (event: MdmarkColumnsChange) => void;
  /** 取り込む文書の表。キーは描く文書のフォルダからのパス。省くと include のマーカーを取り込み先が無い警告にする */
  includes?: Record<string, string>;
  /** まとめていない名前のアイコンの形状の表。表に無い名前は jsDelivr から読み込む */
  icons?: Record<string, MdmarkIconNode>;
  /** `id:` で始まるリンク先（`id:` を含む値）を開く URL に変える関数。本文のリンクと map のノードのリンクに使用する。省くと、`id:` のリンク先を許可しないリンク先として扱う */
  resolveIdLink?: ResolveIdLink;
};

/** `onColumnsChange` が受け取る列の表示 */
export type MdmarkColumnsChange = {
  /** 本文の中の `+columns` の表の出現順（0 から。削除したブロックの中の表は数えない） */
  tableIndex: number;
  /** 隠している列の見出しの文字（列の順） */
  hidden: string[];
};

/** `mount` の戻り値 */
export type MountHandle = {
  /** 本文だけを再描画する。設定は `mount` に指定したものを使用する。`options.baseMarkdown` を指定すると比較元を差し替え、`null` で削除する。`options.includes` を指定すると取り込む文書の表を差し替える。`destroy` の後は何もしない */
  update: (
    markdown: string,
    options?: {
      baseMarkdown?: string | null;
      includes?: Record<string, string>;
    },
  ) => void;
  /** 要素の中を空にして class `mdmark` とテーマの属性を削除し、印刷の受け取りを解除する。2 回目以降は何もしない */
  destroy: () => void;
  /** 本文を再描画せずにコメントを再読み込みし、マーカーをもう一度付けてから解決する。コメントを付けていないときと `destroy` の後は解決する */
  reloadComments: () => Promise<void>;
  /** その `id` のコメントのマーカーへ移って強調する。マーカーが無い `id` と `destroy` の後は何もしない */
  focusComment: (id: string) => void;
};

/** 描く先の要素に付ける class。本文の CSS はこの class の下に該当する */
const ROOT_CLASS = "mdmark";

/** 描く先の要素に、既定を適用した設定の `colorTheme` を値にして付ける属性。`src/index.css` は `:root:has()` でこの属性を確認して、テーマの配色の値を `:root` に適用する */
const COLOR_THEME_ATTRIBUTE = "data-mdmark-color-theme";

/** 描く先の要素に付ける明暗の class。`src/index.css` の `mdmark-theme-light`・`mdmark-theme-dark` と同じ名前 */
const COLOR_SCHEME_CLASSES = {
  light: "mdmark-theme-light",
  dark: "mdmark-theme-dark",
} as const;

/** 印刷の機能の名前 */
const PRINT_FEATURE = "print";

/** 描いた要素から、その `MountHandle` を参照する。同じ要素への `mount` が前の描画を片付けるのに使用する */
const mounted = new WeakMap<HTMLElement, MountHandle>();

/** `mount` の通し番号（mermaid の `render` の id を、ページの中で重ねない） */
let mountCount = 0;

/** 差分のプレビューに出す埋め込んだ HTML の範囲を、文書に描くときと同じ描き方で描く関数を作る: 範囲の HTML を `html` のコードブロックに入れ `<!-- html -->` で囲んだ Markdown を文書を描く処理に経由し、得た枠の中身と、配置した要素にその描画の機能のオン・オフと操作できる部品の定義で記法の操作を付ける関数を返却する。`html` の機能がオフのときは枠が無く、空の文字と何もしない関数を返却する */
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
          diagramPlacement: config.tooltips.diagramPlacement,
          pinMode: config.table.pin,
          pinDefault: config.table.pinDefault,
          codeWrap: config.code.wrap,
          codeWrap: config.code.wrap,
          longColumnMin: config.table.longColumnMin,
        }),
    };
  };
}

/** 描くたびに付け直すものを、片付ける順に並べた名前（範囲のスクリプト・mermaid の図・先頭へ戻るボタン・記法の操作・右側の目次・包んだ本文の列・差分・ビューとコメントの部品） */
const DETACH_ORDER = [
  "previews",
  "scripts",
  "mermaid",
  "backToTop",
  "interactions",
  "sideToc",
  "content",
  "diff",
  "parts",
] as const;

/** 今の文書に付けたものを片付ける関数 */
type Detachers = Partial<Record<(typeof DETACH_ORDER)[number], () => void>>;

/** 言語 markdown のコードブロックの描いた結果を描く mount に、外の文書から引き継ぐ引数 */
function previewOptionsOf(
  opts: MountOptions,
): Omit<MountOptions, "markdown" | "config" | "includes"> {
  const { index, references, aliases, icons, resolveIdLink } = opts;
  return {
    ...(index ? { index } : {}),
    ...(references ? { references } : {}),
    ...(aliases ? { aliases } : {}),
    ...(icons ? { icons } : {}),
    ...(resolveIdLink ? { resolveIdLink } : {}),
  };
}

/** 外の文書の設定の機能に、描いた結果で切る機能を `false` で重ねた設定 */
function previewConfigOf(config: MdmarkConfig | undefined): MdmarkConfig {
  return {
    ...config,
    features: {
      ...config?.features,
      ...Object.fromEntries(PREVIEW_CUT_FEATURES.map((name) => [name, false])),
    },
  };
}

/** 片付ける順に全て片付け、空にする */
function detachAll(detachers: Detachers): void {
  for (const key of DETACH_ORDER) {
    const detach = detachers[key];
    delete detachers[key];
    detach?.();
  }
}

/** Markdown を描いた結果 */
type RenderedDocument = ReturnType<typeof renderDocument>;

/** 比較元が文字列か `null` か `undefined` かを確認し、違えば `baseMarkdown` を含む `TypeError` を投げる */
export function checkBaseMarkdown(
  value: unknown,
): asserts value is string | null | undefined {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new TypeError("baseMarkdown は文字列か null で指定してください");
  }
}

/** HTML 文字列から要素を 1 つ作る */
function parseElement(html: string): HTMLElement {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.firstElementChild as HTMLElement;
}

/** 後と前の文書を、機能 `frontmatter` だけをオンにした同じ引数で描き、前の文書と比べて追加と削除の色を適用した後の文書の中身にする */
function drawColoredBlocks(options: {
  /** 後の Markdown */
  after: string;
  /** 前の Markdown */
  before: string;
  /** Markdown を、機能 `frontmatter` だけをオンにした同じ引数で描いた HTML にする関数 */
  render: (markdown: string) => string;
  /** 元の機能 `frontmatter` のオン・オフ */
  frontmatter: boolean;
}): DocumentFragment {
  const afterTemplate = document.createElement("template");
  afterTemplate.innerHTML = options.render(options.after);
  const beforeTemplate = document.createElement("template");
  beforeTemplate.innerHTML = options.render(options.before);
  colorDiffBlocks({
    before: { root: beforeTemplate.content, markdown: options.before },
    after: { root: afterTemplate.content, markdown: options.after },
    segmenter: createSegmenter(),
    frontmatter: options.frontmatter,
  });
  return afterTemplate.content;
}

/** 描いた結果の入れ子の `mount` が描く先の要素。URL の `#ID` を追わず、外の文書の開いた位置を動かさない */
const previewTargets = new WeakSet<HTMLElement>();

/** 描く先の要素の子を本文の列（`div.mdmark-content`）に包み、本文の列を返却する */
function wrapContent(el: HTMLElement): HTMLElement {
  const content = document.createElement("div");
  content.className = "mdmark-content";
  content.append(...el.childNodes);
  el.append(content);
  return content;
}

/** `markdown` も `rendered` も無いときと、`rendered` を差分・比較元・コメントと一緒に指定したときに `TypeError` を投げる */
function checkRendered(opts: MountOptions): void {
  if (opts.rendered === undefined) {
    if (typeof opts.markdown !== "string") {
      throw new TypeError(
        "markdown か rendered を指定してください（markdown は文字列、rendered は render と同じ処理で描いた結果）",
      );
    }
    return;
  }
  const mixed = (
    [
      ["diffSource", opts.diffSource],
      ["baseMarkdown", opts.baseMarkdown],
      ["commentStore", opts.commentStore],
    ] as const
  )
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key]) => key);
  if (mixed.length > 0) {
    throw new TypeError(
      `rendered は ${mixed.join("・")} と一緒に指定できません。差分・比較元・コメントを使用するときは markdown を指定してください`,
    );
  }
}

/** 要素の中に文書を描き、記法の操作を付け、外部ライブラリと拡張のマーカーを描かせ、ビューとコメントの部品を付け、印刷の受け取りを付けて、再描画と片付けの関数を返却する。`diffSource` か `commentStore` を指定して `docId` が無いとき、`commentStore`・`baseMarkdown`・`onColumnsChange` が合わないときは、何も描かずに `TypeError` を投げる */
export function mount(el: HTMLElement, opts: MountOptions): MountHandle {
  const { diffSource, commentStore, docId, onColumnsChange } = opts;
  checkRendered(opts);
  if (diffSource !== undefined && docId === undefined) {
    throw new TypeError("diffSource を指定するときは docId も指定してください");
  }
  if (commentStore !== undefined) {
    if (docId === undefined) {
      throw new TypeError(
        "commentStore を指定するときは docId も指定してください",
      );
    }
    checkCommentStore(commentStore, "commentStore");
  }
  checkBaseMarkdown(opts.baseMarkdown);
  if (onColumnsChange !== undefined && typeof onColumnsChange !== "function") {
    throw new TypeError("onColumnsChange は関数で指定してください");
  }
  // 比較元の Markdown（無ければ色分けしない）
  let base = opts.baseMarkdown ?? undefined;
  // 取り込む文書の表（`update` で差し替える）
  let includes = opts.includes;
  // 言語 markdown のコードブロックの描いた結果を描く mount に指定する引数と設定
  const previewOptions = previewOptionsOf(opts);
  const previewConfig = previewConfigOf(opts.config);
  // 同じ要素へ 2 回目の mount を呼ぶと、前の描画を先に片付ける
  mounted.get(el)?.destroy();
  mountCount += 1;
  const mountId = mountCount;
  const diffMode = normalizeDiffMode(opts.diffMode);
  const config = resolveConfig({ config: opts.config });
  const renderDiffHtml = createDiffHtmlRenderer({ config, opts });
  // 描く世代: 再描画するたびに進め、古い描画の読み込みの結果を捨てるのに使用する
  let generation = 0;
  let destroyed = false;
  // 今の文書で決まった機能のオン・オフ
  let features = config.features;
  // 今の文書に付けたものを片付ける関数
  const detachers: Detachers = {};
  // 今の文書に付けたビューとコメントの部品
  let parts: PartsHandle | undefined;
  // 右側の目次の状態（`mount` ごとに 1 つ。再描画でも保つ）
  const sideTocState: SideTocState = { open: false, pinned: false };
  // 読者が開閉したセクションの開閉の記録（`mount` ごとに 1 つ。再描画でも保つ）
  const sectionStates: SectionStates = new Map();
  // 読者が開閉した部品の開閉の記録（`mount` ごとに 1 つ。再描画でも保つ）
  const partStates: PartStates = new Map();
  // 前の描画の右側の目次の出し方（出し方が変わったら目次の状態を戻す）
  let lastTocMode: ResolvedConfig["sideToc"]["mode"] | undefined;
  // 色分けのライブラリのモジュールの記録（`mount` ごとに 1 つ。再描画では再読み込みしない）
  const syntaxModules = new Map<string, Promise<{ default?: unknown }>>();
  // mermaid のモジュールの記録（`mount` ごとに 1 つ。再描画では再読み込みしない）
  const mermaidModules = new Map<string, Promise<{ default?: unknown }>>();
  // 範囲のスクリプトの変換のライブラリの読み込みの記録（`mount` ごとに 1 つ）
  const transpilers = new Map<string, Promise<Transpiler>>();
  // コメントの機能に読み込みと保存の関数が要ることを出したか（`mount` ごとに 1 回だけ出す）
  const warned = { missingStore: false };

  /** Markdown を、この `mount` の設定（`drawn` を指定したときはその設定）・索引・取り込む文書で描く */
  const renderMarkdown = (
    markdown: string,
    drawn: ResolvedConfig = config,
  ): RenderedDocument =>
    renderDocument({
      markdown,
      config: drawn,
      index: opts.index,
      docId: opts.docId,
      references: opts.references,
      aliases: opts.aliases,
      includes,
      icons: opts.icons,
      resolveIdLink: opts.resolveIdLink,
      path: opts.path,
    });
  /** 描いた HTML を要素に入れる。`from` があれば、前の Markdown と比べて色分けする */
  const paint = (target: {
    rendered: RenderedDocument;
    markdown: string;
    from: string | undefined;
  }): void => {
    const { rendered, markdown, from } = target;
    if (from === undefined) {
      el.innerHTML = rendered.html;
      return;
    }
    // 比べる中身はフロントマターの折りたたみを持つよう、機能 frontmatter だけをオンにして描く
    const withFrontmatter: ResolvedConfig = {
      ...config,
      features: { ...config.features, frontmatter: true },
    };
    el.replaceChildren(
      drawColoredBlocks({
        after: markdown,
        before: from,
        render: (source) => renderMarkdown(source, withFrontmatter).html,
        frontmatter: rendered.features.frontmatter === true,
      }),
    );
  };
  /** この描画の設定のテーマと明暗を要素に適用する。右側の目次の出し方が変わったら、目次の状態を戻す */
  const applyAppearance = (drawn: ResolvedConfig): void => {
    el.classList.add(ROOT_CLASS);
    el.setAttribute(COLOR_THEME_ATTRIBUTE, drawn.colorTheme);
    el.classList.remove(COLOR_SCHEME_CLASSES.light, COLOR_SCHEME_CLASSES.dark);
    if (drawn.colorScheme !== "auto") {
      el.classList.add(COLOR_SCHEME_CLASSES[drawn.colorScheme]);
    }
    if (lastTocMode !== undefined && lastTocMode !== drawn.sideToc.mode) {
      sideTocState.open = false;
      sideTocState.pinned = false;
    }
    lastTocMode = drawn.sideToc.mode;
  };
  /** Markdown のコピーとエクスポートのボタンが使用する純粋な Markdown を作る関数。描いた結果から描いたときは `opts.pureMarkdown`（無ければボタンを配置しない） */
  const pureMarkdownOf = (
    markdown: string | undefined,
  ): (() => Promise<PureMarkdownResult>) | undefined => {
    const pure = opts.pureMarkdown;
    if (markdown === undefined) {
      return pure === undefined
        ? undefined
        : () => Promise.resolve({ markdown: pure, warnings: [] });
    }
    return () =>
      toPureMarkdown(markdown, {
        config: opts.config,
        index: opts.index,
        docId: opts.docId,
        includes,
      });
  };
  /** 右側の目次を付け、以降の操作と部品を付ける本文の列を返却する。コメントの余白の列を本文の列の右に配置するため、右側の目次が包んでいなければ本文の列に包む */
  const layoutBody = (
    drawn: ResolvedConfig,
    markdown: string | undefined,
  ): { body: HTMLElement; aside: HTMLElement | undefined } => {
    const pureMarkdown = pureMarkdownOf(markdown);
    const sideToc =
      features["side-toc"] === true
        ? attachSideToc({
            el,
            mode: drawn.sideToc.mode,
            sections: features.sections === true,
            markdownButtons: features["markdown-buttons"] === true,
            pureMarkdown,
            state: sideTocState,
          })
        : undefined;
    detachers.sideToc = sideToc?.detach;
    const body = sideToc?.content ?? el;
    const aside = sideToc?.aside;
    const comments =
      features.comments === true &&
      commentStore !== undefined &&
      docId !== undefined;
    if (!comments || body !== el) {
      return { body, aside };
    }
    const content = wrapContent(el);
    detachers.content = () => content.replaceWith(...content.childNodes);
    return { body: content, aside };
  };
  /** まとめていない名前のアイコンを読み込む。読み込みの完了は待たない */
  const loadIcons = (body: HTMLElement, isCurrent: () => boolean): void => {
    void loadInlineIcons({
      root: body,
      icons: opts.icons ?? {},
      isCurrent,
      // 書き出した HTML（外部ライブラリを埋めたとき）は外へ要求せず、表に無い名前を Lucide に無い名前として扱う
      ...(embeddedLibraries === undefined
        ? {}
        : {
            importModule: () => Promise.reject(new Error("embedded")),
            fetchHead: async () => new Response(null, { status: 404 }),
          }),
    });
  };
  /** 範囲のスクリプトを動かす。読み込みの完了は待たない。解決する前に再描画したときは、解決したときに片付ける */
  const startScripts = (body: HTMLElement, isCurrent: () => boolean): void => {
    void runHtmlScripts({
      root: body,
      url: config.htmlScripts.url,
      isCurrent,
      cache: transpilers,
    }).then((destroy) => {
      if (isCurrent()) {
        detachers.scripts = destroy;
      } else {
        destroy();
      }
    });
  };
  /** アイコン・外部ライブラリと拡張・色分け・mermaid・範囲のスクリプトの読み込みを始める */
  const startLoading = (target: {
    body: HTMLElement;
    rendered: MdmarkRendered;
    drawn: ResolvedConfig;
    isCurrent: () => boolean;
  }): void => {
    const { body, rendered, drawn, isCurrent } = target;
    if (features.icon === true) {
      loadIcons(body, isCurrent);
    }
    // 読み込みの完了は待たない
    void loadLibraries({
      root: body,
      libraries: config.libraries,
      isCurrent,
      definitions: rendered.extensionDefinitions,
    });
    // 色分けの対象があるときだけ読み込む。読み込みの完了は待たない
    void highlightCodeBlocks({
      root: body,
      url: config.syntax.url,
      isCurrent,
      modules: syntaxModules,
    });
    // mermaid のコードブロックがあるときだけ読み込む。マーカーの場所を取得した後に読み込み中のブロックを配置する。描き終えるのは待たない
    if (features.mermaid === true) {
      detachers.mermaid = attachMermaid({
        root: body,
        scope: el,
        config: drawn,
        mountId,
        isCurrent,
        modules: mermaidModules,
        placement: config.tooltips.diagramPlacement,
      }).detach;
    }
    if (features["html-scripts"] === true) {
      startScripts(body, isCurrent);
    }
  };
  /** 差分の出し方に合わせて差分を付ける。`blocks` で比較元が無く、色分けせずに描いたときだけ、比べる 2 つの本文を取り出して描き直す（取り出しの完了は待たない） */
  const startDiff = (target: {
    body: HTMLElement;
    aside: HTMLElement | undefined;
    from: string | undefined;
    fromUpdate: boolean;
    isCurrent: () => boolean;
  }): void => {
    const { body, aside, from, fromUpdate, isCurrent } = target;
    if (diffSource === undefined || docId === undefined) {
      return;
    }
    if (diffMode !== "blocks") {
      detachers.diff = attachDiff({
        root: body,
        source: diffSource,
        docId,
        renderHtml: renderDiffHtml,
        hideWith: aside ? [aside] : [],
        open: diffMode === "open",
        controls: opts.diffControls !== false,
        layout: diffMode === "side-by-side" ? "side-by-side" : "lines",
        renderMarkdown: (markdown) => renderMarkdown(markdown).html,
      });
      return;
    }
    if (base !== undefined || from !== undefined) {
      return;
    }
    void loadDiffPair({ source: diffSource, docId }).then((pair) => {
      if (!isCurrent()) {
        return;
      }
      if (pair.kind === "pair" && pair.before !== pair.after) {
        draw(pair.after, pair.before, fromUpdate);
      } else if (pair.kind === "failed") {
        body.prepend(
          parseElement(renderNotice({ name: docId, source: "diff-blocks" })),
        );
      }
    });
  };

  /** 文書を描く。`markdown` が無いときは `opts.rendered` を描く。`coloredFrom` は `blocks` で色分けするときの前の Markdown（`markdown` が後）、`fromUpdate` は `update` から始まった描画か */
  const draw = (
    markdown: string | undefined,
    coloredFrom?: string,
    fromUpdate = false,
  ): void => {
    generation += 1;
    const current = generation;
    const isCurrent = (): boolean => !destroyed && generation === current;
    detachAll(detachers);
    parts = undefined;
    // 比較元があって本文と違うときは、比較元と比べて色分けする
    const from =
      markdown === undefined
        ? undefined
        : (coloredFrom ??
          (base !== undefined && base !== markdown ? base : undefined));
    const rendered =
      markdown === undefined
        ? (opts.rendered as MdmarkRendered)
        : renderMarkdown(markdown);
    if (markdown === undefined) {
      el.innerHTML = rendered.html;
    } else {
      paint({ rendered: rendered as RenderedDocument, markdown, from });
    }
    // 文書の page のマーカーを、既定を適用した設定に重ねてこの描画の設定にする
    const drawn = applyPageSettings({ config, page: rendered.page });
    applyAppearance(drawn);
    features = rendered.features;
    const { body, aside } = layoutBody(drawn, markdown);
    detachers.interactions = attachInteractions({
      root: body,
      features,
      paramDefinitions: rendered.paramDefinitions,
      placement: config.tooltips.placement,
      diagramPlacement: config.tooltips.diagramPlacement,
      pinMode: config.table.pin,
      pinDefault: config.table.pinDefault,
      codeWrap: config.code.wrap,
      longColumnMin: config.table.longColumnMin,
      onColumnsChange,
      sectionStates,
      partStates,
      revealHash: !fromUpdate,
      followHash: !previewTargets.has(el),
    });
    startLoading({ body, rendered, drawn, isCurrent });
    const attached = attachParts({
      root: body,
      features,
      commentStore,
      docId,
      isCurrent,
      warned,
      config: drawn,
      resolveIdLink: opts.resolveIdLink,
    });
    parts = attached;
    detachers.parts = () => attached.detach();
    // 外の文書の操作を付け終えた後に付け、描いた結果の中には入れ子の mount の操作だけが付く
    if (features.code === true) {
      detachers.previews = attachCodePreviews(body, (target, source) => {
        previewTargets.add(target);
        const nested = mount(target, {
          ...previewOptions,
          markdown: source,
          config: previewConfig,
          ...(includes ? { includes } : {}),
        });
        return () => nested.destroy();
      });
    }
    startDiff({ body, aside, from, fromUpdate, isCurrent });
    // 描くたびにもう一度付け、スクロールする場所をもう一度決める
    if (features["back-to-top"] === true) {
      detachers.backToTop = attachBackToTop({ el, content: body });
    }
  };

  draw(opts.rendered === undefined ? opts.markdown : undefined);
  const detachPrint = attachPrint({
    root: el,
    isEnabled: () => features[PRINT_FEATURE] === true,
  });
  const handle: MountHandle = {
    update: (markdown, options) => {
      if (destroyed) {
        return;
      }
      if (options !== undefined) {
        checkBaseMarkdown(options.baseMarkdown);
        if (options.baseMarkdown !== undefined) {
          base = options.baseMarkdown ?? undefined;
        }
        if (options.includes !== undefined) {
          includes = options.includes;
        }
      }
      draw(markdown, undefined, true);
    },
    destroy: () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      sectionStates.clear();
      partStates.clear();
      detachAll(detachers);
      detachPrint();
      el.innerHTML = "";
      el.classList.remove(
        ROOT_CLASS,
        COLOR_SCHEME_CLASSES.light,
        COLOR_SCHEME_CLASSES.dark,
      );
      el.removeAttribute(COLOR_THEME_ATTRIBUTE);
      if (mounted.get(el) === handle) {
        mounted.delete(el);
      }
    },
    reloadComments: () =>
      destroyed || !parts ? Promise.resolve() : parts.reloadComments(),
    focusComment: (id) => {
      if (!destroyed) {
        parts?.focusComment(id);
      }
    },
  };
  mounted.set(el, handle);
  return handle;
}

/** `renderForMount` の第 2 引数（開いたときに `mount` に指定するのと同じ値） */
export type RenderForMountOptions = {
  /** 利用側の設定。省いたキーには既定を適用する */
  config?: MdmarkConfig;
  /** 索引 */
  index?: MdmarkIndex;
  /** 描く文書の索引の `id` */
  docId?: string;
  /** 参照の表 */
  references?: MdmarkReferences;
  /** エイリアス */
  aliases?: MdmarkAlias[];
  /** 取り込む文書の表。描いた結果と純粋な Markdown の両方に取り込む */
  includes?: Record<string, string>;
  /** まとめていない名前のアイコンの形状の表 */
  icons?: Record<string, MdmarkIconNode>;
  /** 描く文書の、設定ファイルのフォルダからの相対パス */
  path?: string;
};

/** `mount` が `opts.markdown` を描くのと同じ処理で描き、`opts.rendered` に指定する描いた結果と `opts.pureMarkdown` に指定する純粋な Markdown を返却する（DOM を使用しない） */
export async function renderForMount(
  markdown: string,
  opts: RenderForMountOptions = {},
): Promise<{ rendered: MdmarkRendered; pureMarkdown: string }> {
  if (typeof markdown !== "string") {
    throw new TypeError(
      "renderForMount の markdown は文字列で指定してください",
    );
  }
  const { config, index, docId, includes } = opts;
  const result = renderDocument({
    markdown,
    config: resolveConfig({ config }),
    index,
    docId,
    references: opts.references,
    aliases: opts.aliases,
    includes,
    icons: opts.icons,
    path: opts.path,
  });
  const pure = await toPureMarkdown(markdown, {
    config,
    index,
    docId,
    includes,
  });
  return {
    rendered: {
      html: result.html,
      features: result.features,
      page: result.page,
      paramDefinitions: result.paramDefinitions,
      extensionDefinitions: result.extensionDefinitions,
    },
    pureMarkdown: pure.markdown,
  };
}
