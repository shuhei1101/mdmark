import type { HLJSApi, LanguageFn } from "highlight.js";
import { highlightLines } from "./highlight-lines.ts";
import { SYNTAX_ATTRIBUTE } from "./parts/code-block.ts";

/** 読み込んだモジュール。本体の `default` は `HLJSApi`、言語の `default` は `LanguageFn` */
type SyntaxModule = { default?: unknown };

/** URL の色分けのモジュールを読み込む関数。既定は動的 `import()` で、単体テストで差し替える */
export type SyntaxImport = (url: string) => Promise<SyntaxModule>;

/** 書き出した HTML の起動の処理が指定する、同じスクリプトにまとめた色分けのモジュール */
export type EmbeddedSyntax = {
  /** 本体（`core.min.js`）のモジュール。埋めなかったときは持たない */
  core?: SyntaxModule | undefined;
  /** 言語のモジュール名からモジュールを参照する表。埋めなかった言語は持たない */
  languages: Record<string, SyntaxModule>;
};

/** `setEmbeddedSyntax` が入れる、埋めたモジュール。無ければ `syntax.url` から読み込む。ページの中の全ての `mount` に有効になる */
export let embeddedSyntax: EmbeddedSyntax | undefined;

/** 埋めた色分けのモジュールを置き換える。`undefined` で `syntax.url` から読み込む構造に戻す */
export function setEmbeddedSyntax(modules: EmbeddedSyntax | undefined): void {
  embeddedSyntax = modules;
}

/** 既定の読み込み: 動的 `import()` */
const importByUrl: SyntaxImport = (url) => import(/* @vite-ignore */ url);

/** 読み込みの失敗を `console.error` に出す */
function reportFailure(what: string, url: string, error: unknown): void {
  console.error(`${what}を読み込めません:`, url, error);
}

/** 読み込む言語のモジュール 1 つ */
type LanguageTarget = {
  name: string;
  url: string;
  read: () => Promise<SyntaxModule>;
};

/** 色分けのライブラリの本体。埋めたモジュールがあれば URL を読み込まず、埋めていなければ `undefined`。読み込めなければ `console.error` に出して `undefined` */
async function loadCore(options: {
  embedded: EmbeddedSyntax | undefined;
  folder: URL;
  load: (target: string) => Promise<SyntaxModule>;
}): Promise<HLJSApi | undefined> {
  const { embedded, folder, load } = options;
  if (embedded) {
    return embedded.core?.default as HLJSApi | undefined;
  }
  const coreUrl = new URL("core.min.js", folder).href;
  try {
    return (await load(coreUrl)).default as HLJSApi;
  } catch (error) {
    reportFailure("色分けのライブラリ", coreUrl, error);
    return undefined;
  }
}

/** 言語のモジュールの読み込み先。埋めたモジュールがあれば埋めた言語だけ、無ければ `languages/{名前}.min.js` */
function languageTargets(options: {
  names: string[];
  embedded: EmbeddedSyntax | undefined;
  folder: URL;
  load: (target: string) => Promise<SyntaxModule>;
}): LanguageTarget[] {
  const { names, embedded, folder, load } = options;
  return names.flatMap((name) => {
    if (embedded) {
      const module = Object.hasOwn(embedded.languages, name)
        ? embedded.languages[name]
        : undefined;
      return module === undefined
        ? []
        : [{ name, url: name, read: () => Promise.resolve(module) }];
    }
    const target = new URL(`languages/${name}.min.js`, folder).href;
    return [{ name, url: target, read: () => load(target) }];
  });
}

/** 言語のモジュールを読み込んで本体に登録し、読み込めた言語の名前を返却する。読み込めないモジュールは `console.error` に出す */
async function registerLanguages(
  hljs: HLJSApi,
  targets: LanguageTarget[],
): Promise<Set<string>> {
  const settled = await Promise.allSettled(
    targets.map((target) => target.read()),
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
  return ready;
}

/** `code` の中身を色分けした HTML に置き換える。行に分けた `code` は行ごとに置き換える */
function paintCode(hljs: HLJSApi, code: HTMLElement, language: string): void {
  const texts = [...code.querySelectorAll<HTMLElement>(".mdmark-code-text")];
  if (texts.length === 0) {
    code.innerHTML = hljs.highlight(code.textContent ?? "", {
      language,
      ignoreIllegals: true,
    }).value;
    return;
  }
  const lines = highlightLines({
    hljs,
    language,
    lines: texts.map((text) => text.textContent ?? ""),
  });
  for (const [index, text] of texts.entries()) {
    text.innerHTML = lines[index] ?? "";
  }
}

/** 要素の中の `code[data-mdmark-syntax]` が 1 つ以上あれば、色分けのライブラリの本体と使用する言語のモジュールを読み込み、読み込めた言語の `code` の中身を色分けした HTML に置き換える。読み込めないモジュールは `console.error` に出して色分けせずに残し、例外は投げない */
export async function highlightCodeBlocks(options: {
  /** 描いた要素 */
  root: HTMLElement;
  /** 既定を適用した設定の `syntax.url` */
  url: string;
  /** 描いた文書がまだ今のものか */
  isCurrent: () => boolean;
  /** `mount` ごとに 1 つの、読み込んだモジュールの記録（URL → 読み込みの Promise） */
  modules: Map<string, Promise<SyntaxModule>>;
  /** モジュールを読み込む関数 */
  importModule?: SyntaxImport;
}): Promise<void> {
  const { root, url, isCurrent, modules, importModule = importByUrl } = options;
  const codes = [
    ...root.querySelectorAll<HTMLElement>(`code[${SYNTAX_ATTRIBUTE}]`),
  ];
  if (codes.length === 0) {
    return;
  }
  /** 同じ `mount` の中で同じモジュールは 1 回だけ読み込む */
  const load = (target: string): Promise<SyntaxModule> => {
    let pending = modules.get(target);
    if (!pending) {
      pending = importModule(target);
      modules.set(target, pending);
    }
    return pending;
  };
  const folder = new URL(url, document.baseURI);
  // 埋めたモジュールがあれば URL を読み込まない。埋めていない本体・言語は色分けせずに残す
  const embedded = embeddedSyntax;
  const hljs = await loadCore({ embedded, folder, load });
  if (!hljs) {
    return;
  }
  const names = [
    ...new Set(codes.map((code) => code.getAttribute(SYNTAX_ATTRIBUTE) ?? "")),
  ];
  const ready = await registerLanguages(
    hljs,
    languageTargets({ names, embedded, folder, load }),
  );
  // 読み込んでいる間に再描画した文書には、色を適用しない
  if (!isCurrent()) {
    return;
  }
  for (const code of codes) {
    const language = code.getAttribute(SYNTAX_ATTRIBUTE) ?? "";
    if (ready.has(language)) {
      paintCode(hljs, code, language);
    }
  }
}
