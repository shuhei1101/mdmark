import { renderSyntaxWarning } from "./parts/syntax-warning.ts";

/** 範囲のコードを CommonJS に変える変換のライブラリ */
export type Transpiler = {
  transform: (code: string, options: object) => { code: string };
};

/** モジュールを読む関数 */
export type ImportModule = (url: string) => Promise<unknown>;

/** 範囲のスクリプトの言語 */
type ScriptLanguage = "ts" | "js";

/** `script` 要素が包んだ関数を渡す、`window` の鍵の名前。動かす間だけ置き、終えたら削除する */
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

/** 変換のライブラリを読めないときに範囲の前に置く知らせの枠 */
const TRANSPILER_NOTICE =
  '<div class="mdmark-notice" role="status"><strong class="mdmark-notice-title">スクリプトを動かせません</strong><p>範囲のスクリプトを変換するライブラリを読み込めませんでした。動きを付けずに表示しています。</p></div>';

/** 書き出した HTML の起動の処理が入れる、範囲のコードの文字から既定のエクスポートを返す関数を引く表。既定は `undefined` */
export let embeddedHtmlScripts: Map<string, () => unknown> | undefined;

/** `embeddedHtmlScripts` を置き換える。`undefined` で変換のライブラリを読む形に戻す */
export function setEmbeddedHtmlScripts(
  scripts: Map<string, () => unknown> | undefined,
): void {
  embeddedHtmlScripts = scripts;
}

/** 既定の `importModule`: URL のモジュールを動的 `import()` で読む */
const importByUrl: ImportModule = (url) => import(/* @vite-ignore */ url);

/** `url` を `document.baseURI` を基準に解決して読み、`disableScriptTags` を呼んで、`transform` を持つ変換のライブラリを返す。同じ `cache` では同じ URL を 1 回だけ読む */
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

/** CommonJS に変えたコードを `(module, exports, require)` を受け取る関数で包み、`window[HTML_SCRIPTS_REGISTRY](通し番号, 関数)` を呼ぶ `script` 要素の中身を返す */
export function wrapRangeScript(options: {
  code: string;
  index: number;
}): string {
  const code = options.code.replace(/<\/script/gi, "<\\/script");
  return `window[${JSON.stringify(HTML_SCRIPTS_REGISTRY)}](${options.index}, function (module, exports, require) {\n${code}\n});\n`;
}

/** 範囲の根の要素の前に書き方の警告を置く */
function warnBefore(scope: Element, message: string): void {
  scope.insertAdjacentHTML("beforebegin", renderSyntaxWarning({ message }));
}

/** 呼ぶと例外を投げる `require` */
function rejectRequire(name: string): never {
  throw new Error(`範囲のスクリプトでは require を使えません: ${name}`);
}

/** 変えたコードを `script` 要素で動かし、登録された関数を返す（構文エラーで登録が無いときは `undefined`） */
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

/** 描いた要素の中の `template.mdmark-html-script` を文書の順に変換して動かし、既定のエクスポートの関数を範囲の根の要素で呼ぶ。範囲が返した `destroy` をまとめて呼ぶ関数を返す */
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
      if (isCurrent()) {
        for (const template of templates) {
          template.parentElement?.insertAdjacentHTML(
            "beforebegin",
            TRANSPILER_NOTICE,
          );
        }
      }
      return noop;
    }
  }
  if (!isCurrent()) {
    return noop;
  }
  const destroys: Array<() => void> = [];
  for (const [index, template] of templates.entries()) {
    const scope = template.parentElement as HTMLElement;
    const lang: ScriptLanguage = template.dataset.lang === "js" ? "js" : "ts";
    const code = template.content.textContent ?? "";
    const fail = (message: string, error: unknown): void => {
      warnBefore(scope, message);
      console.error(`mdmark: 範囲のスクリプト ${index}`, error);
    };
    // 既定のエクスポートを得る
    let exported: unknown;
    if (embedded) {
      const load = embedded.get(code);
      if (!load) {
        fail(
          `範囲の \`${lang}\` をスクリプトとして読めません（構文エラー）。内容はブラウザのコンソールに出しています。`,
          new Error("書き出した HTML に範囲のスクリプトがありません"),
        );
        continue;
      }
      try {
        exported = load();
      } catch (error) {
        fail(
          `範囲の \`${lang}\` が例外を投げたため、動きを付けずに描いています。内容はブラウザのコンソールに出しています。`,
          error,
        );
        continue;
      }
    } else {
      let compiled: string;
      try {
        compiled = (transpiler as Transpiler).transform(
          code,
          TRANSPILE_OPTIONS[lang],
        ).code;
      } catch (error) {
        fail(
          `範囲の \`${lang}\` をスクリプトとして読めません（構文エラー）。内容はブラウザのコンソールに出しています。`,
          error,
        );
        continue;
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
        fail(
          `範囲の \`${lang}\` をスクリプトとして読めません（構文エラー）。内容はブラウザのコンソールに出しています。`,
          scriptError,
        );
        continue;
      }
      const module: { exports: Record<string, unknown> } = { exports: {} };
      try {
        run(module, module.exports, rejectRequire);
        exported = module.exports.default;
      } catch (error) {
        fail(
          `範囲の \`${lang}\` が例外を投げたため、動きを付けずに描いています。内容はブラウザのコンソールに出しています。`,
          error,
        );
        continue;
      }
    }
    if (typeof exported !== "function") {
      fail(
        `範囲の \`${lang}\` の既定のエクスポートが関数ではありません。\`export default\` で、範囲の根の要素を受け取る関数を書いてください。`,
        new TypeError("既定のエクスポートが関数ではありません"),
      );
      continue;
    }
    try {
      const destroy = (exported as (root: HTMLElement) => unknown)(scope);
      if (typeof destroy === "function") {
        destroys.push(destroy as () => void);
      }
    } catch (error) {
      fail(
        `範囲の \`${lang}\` が例外を投げたため、動きを付けずに描いています。内容はブラウザのコンソールに出しています。`,
        error,
      );
    }
  }
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
