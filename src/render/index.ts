import type { MarkdownIt } from "markdown-it";
import {
  type MdmarkConfig,
  type PageSettings,
  type ResolvedConfig,
  resolveConfig,
} from "../config.ts";
import type { MdmarkParamDefinition } from "../diagram/definition.ts";
import type { MdmarkAlias } from "../knowledge/aliases.ts";
import { type MdmarkIndex, normalizeIndex } from "../knowledge/index-shape.ts";
import type { MdmarkReferences } from "../knowledge/references.ts";
import type { MdmarkIconNode } from "../parts/inline-icon.ts";
import { splitFrontmatter } from "./frontmatter.ts";
import { createParser, type RenderEnv } from "./parser.ts";
import { sanitize } from "./sanitize.ts";
import type { CollectedWarning } from "./syntax/warnings.ts";

export type { CollectedWarning } from "./syntax/warnings.ts";

/** 本文の HTML と、文書のマーカーで決まった機能のオン・オフ */
export type RenderedDocument = {
  /** 本文の HTML 文字列 */
  html: string;
  /** 文書のマーカーを重ねて決まった機能のオン・オフ */
  features: Record<string, boolean>;
  /** 範囲で記載した拡張のマーカーから読み込んだ部品の定義。マーカーの場所の `data-mdmark-definition` の番号で参照する。出力の HTML には残さない */
  extensionDefinitions: unknown[];
  /** 描いた操作できる部品の定義。文書の中の並びの順。出力の HTML には残さない */
  paramDefinitions: MdmarkParamDefinition[];
  /** 本文に配置した記載の警告を、警告を配置した順に並べたもの */
  warnings: CollectedWarning[];
  /** 文書の先頭の page のマーカーから読み込んだページの設定 */
  page: PageSettings;
  /** 文書の注記の定義の ID（注記の機能がオフなら空） */
  annotationIds: string[];
};

/** 描くごとに作る、mdmark が出した要素のマーカーの値（乱数 16 バイトの 16 進） */
function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/** 解析器: モジュールで 1 つだけ作り、初めて使用するときに作る */
let parser: MarkdownIt | undefined;

/** Markdown を本文の HTML にし、文書のマーカーで決まった機能のオン・オフと一緒に返却する */
export function renderDocument(options: {
  /** Markdown */
  markdown: string;
  /** 既定を適用した設定 */
  config: ResolvedConfig;
  /** 索引。構造の合わない文書・用語は除いて使用する */
  index?: MdmarkIndex | undefined;
  /** 描く文書の索引の `id`。索引に無い `id` は省いたのと同じ */
  docId?: string | undefined;
  /** 参照の表 */
  references?: MdmarkReferences | undefined;
  /** エイリアス。そのまま入れ、使用できるものへの絞り込みは `buildDictionary` が行う */
  aliases?: MdmarkAlias[] | undefined;
  /** 取り込む文書の表。キーは描く文書のフォルダからのパス */
  includes?: Record<string, string> | undefined;
  /** まとめていない名前のアイコンの形状の表 */
  icons?: Record<string, MdmarkIconNode> | undefined;
}): RenderedDocument {
  parser ??= createParser();
  const index =
    options.index === undefined
      ? undefined
      : normalizeIndex(options.index).index;
  const docId = index?.docs.some((doc) => doc.id === options.docId)
    ? options.docId
    : undefined;
  // 呼び出しごとの値は env で指定し、前の呼び出しのマーカーを持ち越さない
  const env: RenderEnv = {
    libraries: options.config.libraries,
    defaults: options.config.features,
    labels: options.config.labels,
    featureOptions: [],
    markNotes: [],
    features: {},
    headings: [],
    nonce: createNonce(),
    index,
    docId,
    mdmarkReferences: options.references,
    aliases: options.aliases,
    includes: options.includes,
    icons: options.icons,
    ownGlossary: [],
    extensionDefinitions: [],
    paramDefinitions: [],
  };
  // 文書の先頭のフロントマターは空白にして解析し、表示はコアルールが差し込む
  const { body, content, endLine } = splitFrontmatter(options.markdown);
  if (content !== undefined && endLine !== undefined) {
    env.frontmatter = { content, endLine };
  }
  const html = sanitize(parser.render(body, env), env.nonce);
  return { html, ...renderedOf(env) };
}

/** 描いた後の環境から、描いた文書の HTML のほかの値 */
function renderedOf(env: RenderEnv): Omit<RenderedDocument, "html"> {
  return {
    features: env.features,
    extensionDefinitions: env.extensionDefinitions ?? [],
    paramDefinitions: env.paramDefinitions ?? [],
    warnings: env.warnings ?? [],
    page: env.page ?? {},
    annotationIds: [...(env.mdmarkAnnotations?.definitions.keys() ?? [])],
  };
}

/** `render` と同じ設定の当て方で描き、描いたときに配置する記載の警告を HTML にせずに返却する */
export function collectWarnings(
  markdown: string,
  opts: { config?: MdmarkConfig } = {},
): CollectedWarning[] {
  const config = resolveConfig({ config: opts.config });
  return renderDocument({ markdown, config }).warnings;
}

/** 画面を持たずに Markdown を本文の HTML 文字列にする */
export function render(
  markdown: string,
  opts: {
    config?: MdmarkConfig;
    index?: MdmarkIndex;
    docId?: string;
    /** 省くと、関連文書の一覧は索引の `related` だけから出し、他の文書の用語集の表の用語を照合しない */
    references?: MdmarkReferences;
    /** `buildAliases` が作ったエイリアス。省くと、エイリアスを照合しない */
    aliases?: MdmarkAlias[];
    /** 取り込む文書の表。省くと、include のマーカーを取り込み先が無い警告にする */
    includes?: Record<string, string>;
    /** まとめていない名前のアイコンの形状の表。省くと、そのアイコンは中が空の要素にする */
    icons?: Record<string, MdmarkIconNode>;
  } = {},
): string {
  const config = resolveConfig({ config: opts.config });
  return renderDocument({
    markdown,
    config,
    index: opts.index,
    docId: opts.docId,
    references: opts.references,
    aliases: opts.aliases,
    includes: opts.includes,
    icons: opts.icons,
  }).html;
}
