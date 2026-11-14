import { renderSyntaxWarning } from "./parts/syntax-warning.ts";

/** 範囲のコードを CommonJS に変える変換のライブラリ */
export type Transpiler = {
  transform: (code: string, options: object) => { code: string };
};

/** モジュールを読み込む関数 */
export type ImportModule = (url: string) => Promise<unknown>;

/** 範囲のスクリプトの言語 */
type ScriptLanguage = "ts" | "js";

/** `script` 要素が包んだ関数を指定する、`window` の鍵の名前。動かす間だけ配置し、終えたら削除する */
export const HTML_SCRIPTS_REGISTRY = "__mdmarkHtmlScript";

/** 言語ごとの `transform` の設定 */
export const TRANSPILE_OPTIONS: Readonly<Record<ScriptLanguage, object>> = {
  ts: {
    filename: "range.ts",
    presets: ["typescript"],
    plugins: ["transform-modules-commonjs"],
    sourceType: "module",
    babelrc: false,
    configFile: false,
  },
  js: {
    filename: "range.js",
    plugins: ["transform-modules-commonjs"],
    sourceType: "module",
    babelrc: false,
    configFile: false,
  },
};

/** 変換のライブラリを読み込めないときに範囲の前に配置する通知ブロック */
const TRANSPILER_NOTICE =
  '<div class="mdmark-notice" role="status"><strong class="mdmark-notice-title">スクリプトを動かせません</strong><p>範囲のスクリプトを変換するライブラリを読み込めませんでした。動きを付けずに表示しています。</p></div>';

/** 書き出した HTML の起動の処理が入れる、範囲のコードの文字から既定のエクスポートを返却する関数を参照する表。既定は `undefined` */
export let embeddedHtmlScripts: Map<string, () => unknown> | undefined;

/** `embeddedHtmlScripts` を置き換える。`undefined` で変換のライブラリを読み込む構造に戻す */
export function setEmbeddedHtmlScripts(
  scripts: Map<string, () => unknown> | undefined,
): void {
  embeddedHtmlScripts = scripts;
}

/** 既定の `importModule`: URL のモジュールを動的 `import()` で読み込む */
const importByUrl: ImportModule = (url) => import(/* @vite-ignore */ url);

/** `url` を `document.baseURI` を基準に解決して読み込み、`disableScriptTags` を呼んで、`transform` を持つ変換のライブラリを返却する。同じ `cache` では同じ URL を 1 回だけ読み込む */
export function loadTranspiler(options: {
  url: string;
  cache: Map<string, Promise<Transpiler>>;
  importModule: ImportModule;
}): Promise<Transpiler> {
  const { cache, importModule } = options;
  const url = new URL(options.url, document.baseURI).href;
  const cached = cache.get(url);
  if (cached) {
    return cached;
  }
  const loading = importModule(url).then((module) => {
    const exports = module as { default?: unknown } | undefined;
    const library = (exports?.default ?? exports) as
      | (Partial<Transpiler> & { disableScriptTags?: () => void })
      | undefined;
    if (typeof library?.transform !== "function") {
      throw new Error(`変換のライブラリに transform がありません: ${url}`);
    }
    library.disableScriptTags?.();
    return library as Transpiler;
  });
  cache.set(url, loading);
  return loading;
}

/** CommonJS に変えたコードを `(module, exports, require)` を受け取る関数で包み、`window[HTML_SCRIPTS_REGISTRY](通し番号, 関数)` を呼ぶ `script` 要素の中身を返却する */
export function wrapRangeScript(options: {
  code: string;
  index: number;
}): string {
  const code = options.code.replace(/<\/script/gi, "<\\/script");
  return `window[${JSON.stringify(HTML_SCRIPTS_REGISTRY)}](${options.index}, function (module, exports, require) {\n${code}\n});\n`;
}

/** 範囲の根の要素の前に記載の警告を配置する */
function warnBefore(scope: Element, message: string): void {
  scope.insertAdjacentHTML("beforebegin", renderSyntaxWarning({ message }));
}

/** 呼ぶと例外を投げる `require` */
function rejectRequire(name: string): never {
  throw new Error(`範囲のスクリプトでは require を使用できません: ${name}`);
}

/** 変えたコードを `script` 要素で動かし、登録された関数を返却する（構文エラーで登録が無いときは `undefined`） */
function evaluateScript(options: {
  code: string;
  index: number;
  onError: (error: unknown) => void;
}): ((...args: unknown[]) => void) | undefined {
  const registry = window as unknown as Record<string, unknown>;
  let registered: ((...args: unknown[]) => void) | undefined;
  registry[HTML_SCRIPTS_REGISTRY] = (
    index: number,
    run: (...args: unknown[]) => void,
  ) => {
    if (index === options.index) {
      registered = run;
    }
  };
  const onWindowError = (event: ErrorEvent): void => {
    options.onError(event.error ?? event.message);
  };
  window.addEventListener("error", onWindowError);
  const script = document.createElement("script");
  const nonce =
    document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
  if (nonce) {
    script.nonce = nonce;
  }
  script.textContent = wrapRangeScript(options);
  try {
    document.head.append(script);
  } finally {
    script.remove();
    window.removeEventListener("error", onWindowError);
    delete registry[HTML_SCRIPTS_REGISTRY];
  }
  return registered;
}

/** 差分の中の範囲か */
function inDiff(template: Element): boolean {
  return (
    template.closest('[class^="mdmark-diff"], [class*=" mdmark-diff"]') !== null
  );
}

/** 範囲のスクリプト 1 つを読み込んだ・動かした結果。失敗したときは範囲の前に出す文言と、コンソールに出す例外 */
type ScriptOutcome =
  | { ok: true; value: unknown }
  | { ok: false; message: string; error: unknown };

/** 構文エラーで読み込めないときの文言 */
const syntaxErrorMessage = (lang: ScriptLanguage): string =>
  `範囲の \`${lang}\` をスクリプトとして読み込めません（構文エラー）。内容はブラウザのコンソールに出しています。`;

/** 例外を投げたときの文言 */
const thrownMessage = (lang: ScriptLanguage): string =>
  `範囲の \`${lang}\` が例外を投げたため、動きを付けずに描いています。内容はブラウザのコンソールに出しています。`;

/** 関数を呼び、例外を投げたら例外を投げたときの失敗にする */
function attempt(lang: ScriptLanguage, run: () => unknown): ScriptOutcome {
  try {
    return { ok: true, value: run() };
  } catch (error) {
    return { ok: false, message: thrownMessage(lang), error };
  }
}

/** 書き出した HTML に埋めた範囲のスクリプトから、既定のエクスポートを得る */
function exportEmbedded(options: {
  embedded: Map<string, () => unknown>;
  code: string;
  lang: ScriptLanguage;
}): ScriptOutcome {
  const { embedded, code, lang } = options;
  const load = embedded.get(code);
  if (!load) {
    return {
      ok: false,
      message: syntaxErrorMessage(lang),
      error: new Error("書き出した HTML に範囲のスクリプトがありません"),
    };
  }
  return attempt(lang, load);
}

/** 範囲のコードを CommonJS に変えて `script` 要素で動かし、既定のエクスポートを得る */
function exportTranspiled(options: {
  transpiler: Transpiler;
  code: string;
  lang: ScriptLanguage;
  index: number;
}): ScriptOutcome {
  const { transpiler, code, lang, index } = options;
  let compiled: string;
  try {
    compiled = transpiler.transform(code, TRANSPILE_OPTIONS[lang]).code;
  } catch (error) {
    return { ok: false, message: syntaxErrorMessage(lang), error };
  }
  let scriptError: unknown;
  const run = evaluateScript({
    code: compiled,
    index,
    onError: (error) => {
      scriptError = error;
    },
  });
  if (!run) {
    return { ok: false, message: syntaxErrorMessage(lang), error: scriptError };
  }
  const module: { exports: Record<string, unknown> } = { exports: {} };
  return attempt(lang, () => {
    run(module, module.exports, rejectRequire);
    return module.exports.default;
  });
}

/** 既定のエクスポートの関数を範囲の根の要素で呼び、返却した値を結果にする */
function startScript(options: {
  exported: unknown;
  scope: HTMLElement;
  lang: ScriptLanguage;
}): ScriptOutcome {
  const { exported, scope, lang } = options;
  if (typeof exported !== "function") {
    return {
      ok: false,
      message: `範囲の \`${lang}\` の既定のエクスポートが関数ではありません。\`export default\` で、範囲の根の要素を受け取る関数を記載してください。`,
      error: new TypeError("既定のエクスポートが関数ではありません"),
    };
  }
  return attempt(lang, () =>
    (exported as (root: HTMLElement) => unknown)(scope),
  );
}

/** 変換のライブラリを読み込めないとき、今の文書なら全ての範囲の前に通知ブロックを配置する */
function noticeTranspilerFailure(
  templates: HTMLTemplateElement[],
  isCurrent: () => boolean,
): void {
  if (!isCurrent()) {
    return;
  }
  for (const template of templates) {
    template.parentElement?.insertAdjacentHTML(
      "beforebegin",
      TRANSPILER_NOTICE,
    );
  }
}

/** 範囲が返却した `destroy` を、1 回だけまとめて呼ぶ関数。投げた例外はコンソールに出す */
function destroyOnce(destroys: Array<() => void>): () => void {
  let called = false;
  return () => {
    if (called) {
      return;
    }
    called = true;
    for (const destroy of destroys) {
      try {
        destroy();
      } catch (error) {
        console.error("mdmark: 範囲のスクリプトの destroy", error);
      }
    }
  };
}

/** 範囲のスクリプト 1 つを変換して動かし、範囲が返却した `destroy`（無ければ `undefined`）を返却する。失敗したら範囲の前に警告を配置する */
function runTemplate(options: {
  template: HTMLTemplateElement;
  index: number;
  embedded: Map<string, () => unknown> | undefined;
  transpiler: Transpiler | undefined;
}): (() => void) | undefined {
  const { template, index, embedded, transpiler } = options;
  const scope = template.parentElement as HTMLElement;
  const lang: ScriptLanguage = template.dataset.lang === "js" ? "js" : "ts";
  const code = template.content.textContent ?? "";
  // 既定のエクスポートを得て、範囲の根の要素で呼ぶ
  const loaded = embedded
    ? exportEmbedded({ embedded, code, lang })
    : exportTranspiled({
        transpiler: transpiler as Transpiler,
        code,
        lang,
        index,
      });
  const started = loaded.ok
    ? startScript({ exported: loaded.value, scope, lang })
    : loaded;
  if (!started.ok) {
    warnBefore(scope, started.message);
    console.error(`mdmark: 範囲のスクリプト ${index}`, started.error);
    return undefined;
  }
  return typeof started.value === "function"
    ? (started.value as () => void)
    : undefined;
}

/** 描いた要素の中の `template.mdmark-html-script` を文書の順に変換して動かし、既定のエクスポートの関数を範囲の根の要素で呼ぶ。範囲が返却した `destroy` をまとめて呼ぶ関数を返却する */
export async function runHtmlScripts(options: {
  root: HTMLElement;
  url: string;
  isCurrent: () => boolean;
  cache: Map<string, Promise<Transpiler>>;
  importModule?: ImportModule;
}): Promise<() => void> {
  const { root, isCurrent, cache, importModule = importByUrl } = options;
  const templates = [
    ...root.querySelectorAll<HTMLTemplateElement>(
      "div.mdmark-html > template.mdmark-html-script",
    ),
  ].filter((template) => !inDiff(template));
  const noop = (): void => {};
  if (templates.length === 0) {
    return noop;
  }
  const embedded = embeddedHtmlScripts;
  let transpiler: Transpiler | undefined;
  if (!embedded) {
    try {
      transpiler = await loadTranspiler({
        url: options.url,
        cache,
        importModule,
      });
    } catch (error) {
      console.error(
        `mdmark: 範囲のスクリプトを変換するライブラリを読み込めません: ${options.url}`,
        error,
      );
      noticeTranspilerFailure(templates, isCurrent);
      return noop;
    }
  }
  if (!isCurrent()) {
    return noop;
  }
  const destroys: Array<() => void> = [];
  for (const [index, template] of templates.entries()) {
    const destroy = runTemplate({ template, index, embedded, transpiler });
    if (destroy) {
      destroys.push(destroy);
    }
  }
  return destroyOnce(destroys);
}
