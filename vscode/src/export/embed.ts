import { pathToFileURL } from "node:url";
import type { MdmarkConfig } from "../../../src/config.ts";
import {
  collectRangeScripts,
  usedLibraryMarks,
  usedSyntaxLanguages,
  usesMermaid,
} from "../../../src/render/used.ts";
import { moduleDataUrl } from "./html.ts";

/** `http:`・`https:` の URL か */
const HTTP_URL_PATTERN = /^https?:\/\//i;

/** まとめた結果 1 つ */
type BundleResult =
  | { path: string; code: string }
  | { path: string; error: string };

/** 絶対パスのモジュールを 1 つずつ ES モジュールのコードにまとめる関数 */
export type BundleModules = (paths: string[]) => Promise<BundleResult[]>;

/** 相対パス（絶対パスに解決した値）の文字列か */
const isLocal = (value: unknown): value is string =>
  typeof value === "string" && !HTTP_URL_PATTERN.test(value);

/** 文書が使用する相対パスの `libraries` と `html-scripts.url`・`mermaid.url` を `bundle` でまとめ、`data:` の URL に替える。使用しない・まとめられない相対パスの値は削除し、`http:`・`https:` の値と文字列でない値はそのまま返却する */
export async function embedLocalLibraries(options: {
  /** 書き出す全文 */
  markdown: string;
  /** 重ねた設定の `libraries`（相対パスは絶対パスにした値） */
  libraries: Record<string, unknown> | undefined;
  /** 重ねた設定の `html-scripts`（相対パスの `url` は絶対パスにした値） */
  htmlScripts: Record<string, unknown> | undefined;
  /** 重ねた設定の `mermaid`（相対パスの `url` は絶対パスにした値） */
  mermaid?: Record<string, unknown> | undefined;
  /** 範囲のスクリプトを集めるときの重ねた設定 */
  config: MdmarkConfig;
  /** 絶対パスのモジュールをまとめる関数 */
  bundle: BundleModules;
}): Promise<{
  libraries: Record<string, unknown> | undefined;
  htmlScripts: Record<string, unknown> | undefined;
  mermaid: Record<string, unknown> | undefined;
  failures: Array<{ path: string; error: string }>;
}> {
  const { markdown, libraries, htmlScripts, mermaid, config, bundle } = options;
  const localLibraries = Object.fromEntries(
    Object.entries(libraries ?? {}).filter((entry): entry is [string, string] =>
      isLocal(entry[1]),
    ),
  );
  const used = usedLibraryMarks([markdown], localLibraries);
  const scriptUrl = htmlScripts?.url;
  const embedScript =
    isLocal(scriptUrl) && collectRangeScripts({ markdown, config }).length > 0;
  const paths = new Set(
    [...used].flatMap((name) => {
      const path = localLibraries[name];
      return path === undefined ? [] : [path];
    }),
  );
  if (embedScript) {
    paths.add(scriptUrl);
  }
  // mermaid が中で読み込む chunk の動的 `import()` も、`bundle` が同じモジュールに取り込む
  const mermaidUrl = mermaid?.url;
  const embedMermaid =
    isLocal(mermaidUrl) && usesMermaid({ markdowns: [markdown], config });
  if (embedMermaid) {
    paths.add(mermaidUrl);
  }
  const urls = new Map<string, string>();
  const failures: Array<{ path: string; error: string }> = [];
  for (const result of paths.size === 0 ? [] : await bundle([...paths])) {
    if ("error" in result) {
      failures.push(result);
    } else {
      urls.set(result.path, moduleDataUrl(result.code));
    }
  }
  const embeddedLibraries =
    libraries === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(libraries).flatMap(([name, value]) => {
            if (!isLocal(value)) {
              return [[name, value]];
            }
            const url = used.has(name) ? urls.get(value) : undefined;
            return url === undefined ? [] : [[name, url]];
          }),
        );
  let embeddedScripts = htmlScripts;
  if (htmlScripts !== undefined && isLocal(scriptUrl)) {
    const { url: _, ...rest } = htmlScripts;
    const url = embedScript ? urls.get(scriptUrl) : undefined;
    embeddedScripts = url === undefined ? rest : { ...rest, url };
  }
  let embeddedMermaid = mermaid;
  if (mermaid !== undefined && embedMermaid) {
    const { url: _, ...rest } = mermaid;
    const url = urls.get(mermaidUrl);
    embeddedMermaid = url === undefined ? rest : { ...rest, url };
  }
  return {
    libraries: embeddedLibraries,
    htmlScripts: embeddedScripts,
    mermaid: embeddedMermaid,
    failures,
  };
}

/** 相対パス（絶対パスに解決した値）の `syntax.url` のフォルダの `core.min.js` と、文書が使用する言語の `languages/{言語}.min.js` を `bundle` でまとめ、import map の `imports` と、`url` をフォルダの `file:` の URL に替えた `syntax` を返却する。色分けの対象が無い文書では `url` を削除してまとめない。`http:`・`https:` の値と文字列でない値はそのまま返却する */
export async function embedLocalSyntax(options: {
  /** 書き出す全文 */
  markdown: string;
  /** 重ねた設定の `syntax`（相対パスの `url` は絶対パスにした値） */
  syntax: Record<string, unknown> | undefined;
  /** `usedSyntaxLanguages` に指定する重ねた設定 */
  config: MdmarkConfig;
  /** 絶対パスを ES モジュールにまとめる関数 */
  bundle: BundleModules;
}): Promise<{
  syntax: Record<string, unknown> | undefined;
  imports: Record<string, string>;
  failures: Array<{ path: string; error: string }>;
}> {
  const { markdown, syntax, config, bundle } = options;
  const url = syntax?.url;
  if (syntax === undefined || !isLocal(url)) {
    return { syntax, imports: {}, failures: [] };
  }
  const languages = usedSyntaxLanguages({ markdowns: [markdown], config });
  if (languages.length === 0) {
    const { url: _, ...rest } = syntax;
    return {
      syntax: Object.keys(rest).length === 0 ? undefined : rest,
      imports: {},
      failures: [],
    };
  }
  const folder = url.endsWith("/") ? url : `${url}/`;
  const folderUrl = pathToFileURL(folder).href;
  /** まとめる絶対パス → フォルダからの相対パス */
  const relatives = new Map(
    ["core.min.js", ...languages.map((name) => `languages/${name}.min.js`)].map(
      (relative) => [`${folder}${relative}`, relative],
    ),
  );
  const imports: Record<string, string> = {};
  const failures: Array<{ path: string; error: string }> = [];
  for (const result of await bundle([...relatives.keys()])) {
    if ("code" in result) {
      imports[`${folderUrl}${relatives.get(result.path)}`] = moduleDataUrl(
        result.code,
      );
    } else {
      failures.push(result);
    }
  }
  return { syntax: { ...syntax, url: folderUrl }, imports, failures };
}
