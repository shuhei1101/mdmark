// PoC: markdown-it-footnote の出力を部品の HTML に組み替え、sanitize の後も id・href が残るか、
// 機能のオフ（設定・文書のマーカー）で書いた文字のまま残せるかを確かめる
import type { MarkdownIt as MarkdownItParser, StateCore, Token } from "markdown-it";
import footnote from "markdown-it-footnote";
import { DEFAULT_FEATURES } from "../../src/config.ts";
import { createParser, type RenderEnv } from "../../src/render/parser.ts";
import { sanitize } from "../../src/render/sanitize.ts";

const OWN = "data-mdmark-own";
const FOOTNOTE_RULES = ["footnote_def", "footnote_inline", "footnote_ref", "footnote_tail"];

type FootnoteEnv = RenderEnv & { mdmarkFootnoteHtml?: Record<number, string> };

/** 定義の中身を、番号のツールチップへ出す HTML として先に描いておくコアルール */
const collectFootnoteHtml = (parser: MarkdownItParser) => (state: StateCore): void => {
  const env = state.env as FootnoteEnv;
  const html: Record<number, string> = {};
  let current: number | undefined;
  let inner: Token[] = [];
  for (const token of state.tokens) {
    if (token.type === "footnote_open") {
      current = token.meta.id as number;
      inner = [];
    } else if (token.type === "footnote_close" && current !== undefined) {
      html[current] = parser.renderer.render(inner, parser.options, env).trim();
      current = undefined;
    } else if (current !== undefined && token.type !== "footnote_anchor") {
      // 戻るリンクはツールチップに出さない
      const children = token.children?.filter((child) => child.type !== "footnote_anchor") ?? null;
      const copy = Object.assign(Object.create(Object.getPrototypeOf(token)), token, { children });
      inner.push(copy);
    }
  }
  env.mdmarkFootnoteHtml = html;
};

/** プラグインの描き方を、mdmark の部品の HTML に組み替える */
const overrideRenderers = (parser: MarkdownItParser): void => {
  const rules = parser.renderer.rules;
  rules.footnote_ref = (tokens, index, _options, env: FootnoteEnv) => {
    const { id, subId = 0 } = tokens[index]?.meta as { id: number; subId?: number };
    const n = id + 1;
    const nonce = env.nonce;
    const tipId = `mdmark-fn-tip-${n}-${subId}`;
    const body = env.mdmarkFootnoteHtml?.[id] ?? "";
    return (
      `<sup class="mdmark-fn-ref" ${OWN}="${nonce}">` +
      `<a href="#mdmark-fn-${n}" id="mdmark-fnref-${n}-${subId}" class="mdmark-fn-link" aria-describedby="${tipId}" ${OWN}="${nonce}">${n}</a>` +
      `<span role="tooltip" id="${tipId}" class="mdmark-fn-tip" ${OWN}="${nonce}">` +
      `<span class="mdmark-fn-tip-title" ${OWN}="${nonce}">脚注 ${n}</span>${body}</span></sup>`
    );
  };
  rules.footnote_block_open = (_tokens, _index, _options, env: FootnoteEnv) =>
    `<details class="mdmark-footnotes" ${OWN}="${env.nonce}"><summary ${OWN}="${env.nonce}">脚注</summary><ol class="mdmark-footnotes-list" ${OWN}="${env.nonce}">`;
  rules.footnote_block_close = () => "</ol></details>";
  rules.footnote_open = (tokens, index, _options, env: FootnoteEnv) =>
    `<li id="mdmark-fn-${(tokens[index]?.meta.id as number) + 1}" class="mdmark-fn-item" ${OWN}="${env.nonce}">`;
  rules.footnote_close = () => "</li>";
  rules.footnote_anchor = (tokens, index, _options, env: FootnoteEnv) => {
    const { id, subId = 0 } = tokens[index]?.meta as { id: number; subId?: number };
    const n = id + 1;
    return ` <a href="#mdmark-fnref-${n}-${subId}" class="mdmark-fn-back" aria-label="本文の脚注 ${n} へ戻る" ${OWN}="${env.nonce}">↩</a>`;
  };
};

/** 今の解析器に脚注のプラグインと組み替えを足す */
const createFootnoteParser = (): MarkdownItParser => {
  const parser = createParser().use(footnote);
  parser.core.ruler.after("footnote_tail", "mdmark_collect_footnotes", collectFootnoteHtml(parser));
  overrideRenderers(parser);
  return parser;
};

const createEnv = (footnotes: boolean): FootnoteEnv => ({
  libraries: {},
  defaults: { ...DEFAULT_FEATURES, footnotes },
  featureArgs: [],
  features: {},
  headings: [],
  nonce: "poc-nonce",
  ownGlossary: [],
  extensionDefinitions: [],
  paramDefinitions: [],
});

// 案 A: 解析の前に features のマーカーだけを読み、解析器を選ぶ
const plainParser = createParser();
const footnoteParser = createFootnoteParser();
const FEATURES_MARK = /<!--\s*features:\s*(.*?)\s*-->/gs;

/** 文書の中の features のマーカーを、今の解析器の block の解析で読み、脚注の有無を返す */
const resolveFootnotes = (markdown: string, footnotes: boolean): boolean => {
  if (!FEATURES_MARK.test(markdown)) {
    return footnotes;
  }
  FEATURES_MARK.lastIndex = 0;
  // コードブロックの中のマーカーを数えないよう、今の解析器の解析で印を拾う
  const env = createEnv(footnotes);
  plainParser.parse(markdown, env);
  return env.features.footnotes ?? footnotes;
};

const renderWithA = (markdown: string, footnotes: boolean): string => {
  const on = resolveFootnotes(markdown, footnotes);
  const env = createEnv(on);
  const parser = on ? footnoteParser : plainParser;
  return sanitize(parser.render(markdown, env), env.nonce);
};

// 案 B: 1 つの解析器で、呼び出しごとに脚注のルールを切り替える
const toggledParser = createFootnoteParser();
const renderWithB = (markdown: string, footnotes: boolean): string => {
  // 文書のマーカーは解析の後に読むため、ルールを切るかは解析の前に決めるしかない
  const on = resolveFootnotes(markdown, footnotes);
  if (!on) {
    toggledParser.disable(FOOTNOTE_RULES);
  }
  try {
    const env = createEnv(on);
    return sanitize(toggledParser.render(markdown, env), env.nonce);
  } finally {
    if (!on) {
      toggledParser.enable(FOOTNOTE_RULES);
    }
  }
};

// 案 C: 解析器は 1 つ。inline の解析の後・footnote_tail の前に文書のマーカーで機能を決め、オフなら脚注のトークンを書いた文字に戻す
const MARK_FEATURES = /<!--\s*features:\s*(.*?)\s*-->/s;
/** html_block のマーカーから、脚注の機能のオン・オフを決める（コードブロックは fence のトークンなので数えない） */
const footnotesEnabled = (state: StateCore): boolean => {
  const env = state.env as FootnoteEnv;
  let on = env.defaults.footnotes ?? true;
  for (const token of state.tokens) {
    if (token.type !== "html_block") continue;
    const args = MARK_FEATURES.exec(token.content)?.[1]?.split(/\s+/) ?? [];
    for (const arg of args) {
      if (arg === "+footnotes") on = true;
      if (arg === "-footnotes") on = false;
    }
  }
  return on;
};
const textToken = (state: StateCore, content: string): Token => {
  const token = new state.Token("text", "", 0);
  token.content = content;
  return token;
};
/** オフのとき、脚注のトークンを書いた文字に戻し、footnote_tail に何もさせない */
const revertFootnotes = (state: StateCore): void => {
  if (footnotesEnabled(state)) return;
  const env = state.env as FootnoteEnv & { footnotes?: { list?: Array<{ content?: string; label?: string }> } };
  const list = env.footnotes?.list ?? [];
  const next: Token[] = [];
  let pendingLabel: string | undefined;
  for (const token of state.tokens) {
    if (token.type === "footnote_reference_open") {
      pendingLabel = token.meta.label as string;
      continue;
    }
    if (token.type === "footnote_reference_close") continue;
    if (token.type === "inline" && token.children) {
      token.children = token.children.map((child) => {
        if (child.type !== "footnote_ref") return child;
        const entry = list[child.meta.id as number];
        return textToken(state, entry?.label === undefined ? `^[${entry?.content ?? ""}]` : `[^${child.meta.label}]`);
      });
      if (pendingLabel !== undefined) {
        token.children.unshift(textToken(state, `[^${pendingLabel}]: `));
        pendingLabel = undefined;
      }
    }
    next.push(token);
  }
  state.tokens = next;
  delete env.footnotes;
};
const switchedParser = createFootnoteParser();
switchedParser.core.ruler.before("footnote_tail", "mdmark_revert_footnotes", revertFootnotes);
const renderWithC = (markdown: string, footnotes: boolean): string => {
  const env = createEnv(footnotes);
  return sanitize(switchedParser.render(markdown, env), env.nonce);
};

// 確かめる文書
const DOCS = {
  basic: "本文の 1 つ目[^src]。\n\n定義の段落の後の 2 つ目^[行内の補足]。\n\n[^src]: 出典の説明\n\n終わりの段落。\n",
  twice: "1 回目[^note]。\n\n2 回目[^note]。\n\n[^note]: 共通の補足\n",
  missing: "定義の無い参照[^missing]。\n",
  markOff: "<!-- features: -footnotes -->\n\n本文[^src]。\n\n[^src]: 出典の説明\n",
  markInCode: "```md\n<!-- features: -footnotes -->\n```\n\n本文[^src]。\n\n[^src]: 出典の説明\n",
  multiPara: "本文[^long]。\n\n[^long]: 1 段落目\n\n    2 段落目\n",
};

const results: Array<{ name: string; ok: boolean; detail?: string }> = [];
const check = (name: string, ok: boolean, detail?: string): void => {
  results.push({ name, ok, detail: ok ? undefined : detail });
};

for (const [label, renderDoc] of [
  ["A", renderWithA],
  ["B", renderWithB],
  ["C", renderWithC],
] as const) {
  const basic = renderDoc(DOCS.basic, true);
  check(`${label} 読み取り: 番号 1 と 2`, /mdmark-fnref-1-0[^>]*>1<\/a>/.test(basic) && /mdmark-fnref-2-0[^>]*>2<\/a>/.test(basic), basic);
  check(`${label} 読み取り: [^・^[ の文字が残らない`, !basic.includes("[^") && !basic.includes("^["), basic);
  check(`${label} 組み替え: ツールチップに中身`, /role="tooltip"[^>]*>.*脚注 1.*出典の説明/s.test(basic), basic);
  check(`${label} 組み替え: 閉じた details の一覧`, /<details class="mdmark-footnotes"(?![^>]*open)/.test(basic), basic);
  check(`${label} 組み替え: 既定の section が残らない`, !basic.includes("footnotes-sep") && !basic.includes('<section class="footnotes"'), basic);
  check(`${label} sanitize の後: 番号の href`, basic.includes('href="#mdmark-fn-1"'), basic);
  check(`${label} sanitize の後: 一覧の項目の id`, basic.includes('id="mdmark-fn-1"'), basic);
  check(`${label} sanitize の後: 戻るリンクの href`, basic.includes('href="#mdmark-fnref-1-0"'), basic);
  check(`${label} sanitize の後: aria-describedby`, basic.includes('aria-describedby="mdmark-fn-tip-1-0"'), basic);

  const twice = renderDoc(DOCS.twice, true);
  check(`${label} 複数回: どちらも番号 1`, (twice.match(/class="mdmark-fn-link"[^>]*>1<\/a>/g) ?? []).length === 2, twice);
  check(`${label} 複数回: 項目は 1 つで戻るリンクが 2 つ`, (twice.match(/mdmark-fn-item/g) ?? []).length === 1 && (twice.slice(twice.indexOf("<details")).match(/mdmark-fn-back/g) ?? []).length === 2, twice);

  const missing = renderDoc(DOCS.missing, true);
  check(`${label} 定義の無い参照: 文字のまま・一覧なし`, missing.includes("[^missing]") && !missing.includes("mdmark-footnotes"), missing);

  const multi = renderDoc(DOCS.multiPara, true);
  check(`${label} 定義の複数段落: 2 段落がツールチップに入る`, /role="tooltip".*1 段落目.*2 段落目/s.test(multi), multi);

  const offByConfig = renderDoc(DOCS.basic, false);
  check(`${label} 設定でオフ: 文字のまま`, offByConfig.includes("[^src]") && offByConfig.includes("[^src]: 出典の説明") && !offByConfig.includes("mdmark-fn"), offByConfig);
  const offByMark = renderDoc(DOCS.markOff, true);
  check(`${label} 文書のマーカーでオフ: 文字のまま`, offByMark.includes("[^src]") && offByMark.includes("[^src]: 出典の説明") && !offByMark.includes("mdmark-fn"), offByMark);
  const markInCode = renderDoc(DOCS.markInCode, true);
  check(`${label} コードブロックの中のマーカーは数えない`, markInCode.includes("mdmark-fn-link"), markInCode);

  // オンとオフを交互に流して、状態が持ち越されないか
  const sequence = [true, false, true, false].map((on) => renderDoc(on ? DOCS.basic : DOCS.markOff, true));
  check(
    `${label} 交互の呼び出しで持ち越さない`,
    sequence[0] === sequence[2] && sequence[1] === sequence[3] && (sequence[0] ?? "").includes("mdmark-fn-link") && !(sequence[1] ?? "").includes("mdmark-fn"),
    sequence.join("\n----\n"),
  );
}

// 案 B: 例外で enable が飛ぶと次の呼び出しへ持ち越すことの確認（try/finally が要る）
toggledParser.disable(FOOTNOTE_RULES);
const leaked = sanitize(toggledParser.render(DOCS.basic, createEnv(true)), "poc-nonce");
toggledParser.enable(FOOTNOTE_RULES);
check("B disable を戻さないと次のオンの呼び出しに持ち越す（finally が要る）", !leaked.includes("mdmark-fn-link"), leaked);

for (const { name, ok, detail } of results) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (detail) {
    console.log(`  ${detail.replaceAll("\n", "\n  ").slice(0, 2000)}`);
  }
}
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} pass`);
console.log("\n--- 正常の文書の出力 ---");
console.log(renderWithC(DOCS.basic, true));
console.log("--- C でオフにした文書の出力 ---");
console.log(renderWithC(DOCS.markOff, true));
console.log(renderWithC(DOCS.multiPara, false));
