import MarkdownIt, { type StateCore, type Token } from "markdown-it";
import {
  resolveDocumentFeatures,
  takeMarks,
} from "../../../src/render/marks.ts";
import { createEnv } from "./env.ts";

/** 印を拾って機能を重ねた後に `rules` だけを当てた解析器で Markdown を解析し、トークンを返す（`features` で機能を上書きする） */
export function parseWithRules(
  markdown: string,
  rules: Array<(state: StateCore) => void>,
  features: Record<string, boolean> = {},
): Token[] {
  const parser = new MarkdownIt({ html: true, linkify: true });
  parser.core.ruler.push("test_take_marks", takeMarks);
  parser.core.ruler.push("test_resolve_features", resolveDocumentFeatures);
  for (const [position, rule] of rules.entries()) {
    parser.core.ruler.push(`test_rule_${position}`, rule);
  }
  const env = createEnv();
  env.defaults = { ...env.defaults, ...features };
  return parser.parse(markdown, env);
}

/** トークンと、その `inline` の子のトークンを、現れた順に全て返す */
export function flattenTokens(tokens: Token[]): Token[] {
  return tokens.flatMap((token) => [token, ...(token.children ?? [])]);
}
