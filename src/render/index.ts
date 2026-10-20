import type { MarkdownIt } from "markdown-it";
import {
  type MdmarkConfig,
  type ResolvedConfig,
  resolveConfig,
} from "../config.ts";
import type { MdmarkParamDefinition } from "../diagram/definition.ts";
import { type MdmarkIndex, normalizeIndex } from "../knowledge/index-shape.ts";
import type { MdmarkReferences } from "../knowledge/references.ts";
import { createParser, type RenderEnv } from "./parser.ts";
import { sanitize } from "./sanitize.ts";

/** 本文の HTML と、文書の印で決まった機能のオン・オフ */
export type RenderedDocument = {
  /** 本文の HTML 文字列 */
  html: string;
  /** 文書の印を重ねて決まった機能のオン・オフ */
  features: Record<string, boolean>;
  /** 範囲で書いた拡張の印から読んだ部品の定義。印の場所の `data-mdmark-definition` の番号で引く。出力の HTML には残さない */
  extensionDefinitions: unknown[];
  /** 描いた操作できる部品の定義。文書の中の並びの順。出力の HTML には残さない */
  paramDefinitions: MdmarkParamDefinition[];
};

/** 描くごとに作る、mdmark が出した要素の印の値（乱数 16 バイトの 16 進） */
function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/** 解析器: モジュールで 1 つだけ作り、初めて使うときに作る */
let parser: MarkdownIt | undefined;

/** Markdown を本文の HTML にし、文書の印で決まった機能のオン・オフと一緒に返す */
export function renderDocument(options: {
  /** Markdown */
  markdown: string;
  /** 既定を当てた設定 */
  config: ResolvedConfig;
  /** 索引。形の合わない文書・用語は除いて使う */
  index?: MdmarkIndex | undefined;
  /** 描く文書の索引の `id`。索引に無い `id` は省いたのと同じ */
  docId?: string | undefined;
  /** 参照の表 */
  references?: MdmarkReferences | undefined;
}): RenderedDocument {
  parser ??= createParser();
  const index =
    options.index === undefined
      ? undefined
      : normalizeIndex(options.index).index;
  // 呼び出しごとの値は env で渡し、前の呼び出しの印を持ち越さない
  const env: RenderEnv = {
    libraries: options.config.libraries,
    defaults: options.config.features,
    featureArgs: [],
    features: {},
    headings: [],
    nonce: createNonce(),
    index,
    docId: index?.docs.some((doc) => doc.id === options.docId)
      ? options.docId
      : undefined,
    mdmarkReferences: options.references,
    ownGlossary: [],
    extensionDefinitions: [],
    paramDefinitions: [],
  };
  const html = sanitize(parser.render(options.markdown, env), env.nonce);
  return {
    html,
    features: env.features,
    extensionDefinitions: env.extensionDefinitions ?? [],
    paramDefinitions: env.paramDefinitions ?? [],
  };
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
  } = {},
): string {
  const config = resolveConfig({ config: opts.config });
  return renderDocument({
    markdown,
    config,
    index: opts.index,
    docId: opts.docId,
    references: opts.references,
  }).html;
}
