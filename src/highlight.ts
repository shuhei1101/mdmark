import type { HLJSApi, LanguageFn } from "highlight.js";
import { highlightLines } from "./highlight-lines.ts";
import { SYNTAX_ATTRIBUTE } from "./parts/code-block.ts";

/** 読んだモジュール。本体の `default` は `HLJSApi`、言語の `default` は `LanguageFn` */
type SyntaxModule = { default?: unknown };

/** URL の色分けのモジュールを読む関数。既定は動的 `import()` で、単体テストで差し替える */
export type SyntaxImport = (url: string) => Promise<SyntaxModule>;

/** 書き出した HTML の起動の処理が渡す、埋めた色分けのモジュールの `blob:` URL */
export type SyntaxModuleUrls = {
  /** 本体（`core.min.js`）の URL */
  core: string;
  /** 言語のモジュール名から URL を引く表。埋めなかった言語は持たない */
  languages: Record<string, string>;
};

/** `setSyntaxModuleUrls` が入れる、埋めたモジュールの URL。無ければ `syntax.url` から読む。ページの中の全ての `mount` に効く */
export let syntaxModuleUrls: SyntaxModuleUrls | undefined;

/** 埋めた色分けのモジュールの URL を置き換える。`undefined` で `syntax.url` から読む形に戻す */
export function setSyntaxModuleUrls(urls: SyntaxModuleUrls | undefined): void {
  syntaxModuleUrls = urls;
}

/** 既定の読み込み: 動的 `import()` */
const importByUrl: SyntaxImport = (url) => import(/* @vite-ignore */ url);

/** 読み込みの失敗を `console.error` に出す */
function reportFailure(what: string, url: string, error: unknown): void {
  console.error(`${what}を読めません:`, url, error);
}

/** 要素の中の `code[data-mdmark-syntax]` が 1 つ以上あれば、色分けのライブラリの本体と使う言語のモジュールを読み、読めた言語の `code` の中身を色分けした HTML に置き換える。読めないモジュールは `console.error` に出して色分けせずに残し、例外は投げない */
export async function highlightCodeBlocks(options: {
  /** 描いた要素 */
  root: HTMLElement;
  /** 既定を当てた設定の `syntax.url` */
  url: string;
  /** 描いた文書がまだ今のものか */
  isCurrent: () => boolean;
  /** `mount` ごとに 1 つの、読んだモジュールの控え（URL → 読み込みの Promise） */
  modules: Map<string, Promise<SyntaxModule>>;
  /** モジュールを読む関数 */
  importModule?: SyntaxImport;
}): Promise<void> {
  const { root, url, isCurrent, modules, importModule = importByUrl } = options;
  const codes = [
    ...root.querySelectorAll<HTMLElement>(`code[${SYNTAX_ATTRIBUTE}]`),
  ];
  if (codes.length === 0) {
    return;
  }
  /** 同じ `mount` の中で同じモジュールは 1 回だけ読む */
  const load = (target: string): Promise<SyntaxModule> => {
    let pending = modules.get(target);
    if (!pending) {
      pending = importModule(target);
      modules.set(target, pending);
    }
    return pending;
  };
  const folder = new URL(url, document.baseURI);
  const embedded = syntaxModuleUrls;
  const coreUrl = embedded?.core ?? new URL("core.min.js", folder).href;
  let hljs: HLJSApi;
  try {
    hljs = (await load(coreUrl)).default as HLJSApi;
  } catch (error) {
    reportFailure("色分けのライブラリ", coreUrl, error);
    return;
  }
  const names = [
    ...new Set(codes.map((code) => code.getAttribute(SYNTAX_ATTRIBUTE) ?? "")),
  ];
  const targets = names.flatMap((name) => {
    const target = embedded
      ? embedded.languages[name]
      : new URL(`languages/${name}.min.js`, folder).href;
    return target === undefined ? [] : [{ name, url: target }];
  });
  const settled = await Promise.allSettled(
    targets.map((target) => load(target.url)),
  );
  const ready = new Set<string>();
  for (const [index, result] of settled.entries()) {
    const target = targets[index];
    if (!target) {
      continue;
    }
    if (result.status === "rejected") {
      reportFailure("色分けの言語のモジュール", target.url, result.reason);
      continue;
    }
    if (!hljs.getLanguage(target.name)) {
      hljs.registerLanguage(target.name, result.value.default as LanguageFn);
    }
    ready.add(target.name);
  }
  // 読んでいる間に描き直した文書には、色を当てない
  if (!isCurrent()) {
    return;
  }
  for (const code of codes) {
    const language = code.getAttribute(SYNTAX_ATTRIBUTE) ?? "";
    if (!ready.has(language)) {
      continue;
    }
    const texts = [...code.querySelectorAll<HTMLElement>(".mdmark-code-text")];
    if (texts.length > 0) {
      const lines = highlightLines({
        hljs,
        language,
        lines: texts.map((text) => text.textContent ?? ""),
      });
      for (const [index, text] of texts.entries()) {
        text.innerHTML = lines[index] ?? "";
      }
    } else {
      code.innerHTML = hljs.highlight(code.textContent ?? "", {
        language,
        ignoreIllegals: true,
      }).value;
    }
  }
}
