import type { MarkdownIt } from "markdown-it";
import {
  type MdmarkConfig,
  type ResolvedConfig,
  resolveConfig,
} from "../config.ts";
import { createParser, type RenderEnv } from "./parser.ts";
import { sanitize } from "./sanitize.ts";

/** 本文の HTML と、文書の印で決まった機能のオン・オフ */
export type RenderedDocument = {
  /** 本文の HTML 文字列 */
  html: string;
  /** 文書の印を重ねて決まった機能のオン・オフ */
  features: Record<string, boolean>;
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
}): RenderedDocument {
  parser ??= createParser();
  // 呼び出しごとの値は env で渡し、前の呼び出しの印を持ち越さない
  const env: RenderEnv = {
    libraries: options.config.libraries,
    defaults: options.config.features,
    featureArgs: [],
    features: {},
    headings: [],
    nonce: createNonce(),
  };
  const html = sanitize(parser.render(options.markdown, env), env.nonce);
  return { html, features: env.features };
}

/** 画面を持たずに Markdown を本文の HTML 文字列にする */
export function render(
  markdown: string,
  opts: { config?: MdmarkConfig } = {},
): string {
  const config = resolveConfig({ config: opts.config });
  return renderDocument({ markdown, config }).html;
}
