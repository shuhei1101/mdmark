import type { MarkdownIt } from "markdown-it";
import {
  type MdmarkConfig,
  type ResolvedConfig,
  resolveConfig,
} from "../config.ts";
import { resolveFeatures } from "../features.ts";
import { createParser, type RenderEnv } from "./parser.ts";
import { sanitize } from "./sanitize.ts";

/** 本文の HTML と、文書の印で決まった機能のオン・オフ */
export type RenderedDocument = {
  /** 本文の HTML 文字列 */
  html: string;
  /** `resolveFeatures` が返したオン・オフ */
  features: Record<string, boolean>;
};

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
    featureArgs: [],
  };
  const html = sanitize(parser.render(options.markdown, env));
  const features = resolveFeatures({
    defaults: options.config.features,
    args: env.featureArgs,
  });
  return { html, features };
}

/** 画面を持たずに Markdown を本文の HTML 文字列にする */
export function render(
  markdown: string,
  opts: { config?: MdmarkConfig } = {},
): string {
  const config = resolveConfig({ config: opts.config });
  return renderDocument({ markdown, config }).html;
}
