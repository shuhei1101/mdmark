import type { MdmarkConfig } from "../../../src/config.ts";
import {
  collectRangeScripts,
  usedLibraryMarks,
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

/** 文書が使う相対パスの `libraries` と `html-scripts.url` を `bundle` でまとめ、`data:` の URL に替える。使わない・まとめられない相対パスの値は外し、`http:`・`https:` の値と文字列でない値はそのまま返す */
export async function embedLocalLibraries(options: {
  /** 書き出す全文 */
  markdown: string;
  /** 重ねた設定の `libraries`（相対パスは絶対パスにした値） */
  libraries: Record<string, unknown> | undefined;
  /** 重ねた設定の `html-scripts`（相対パスの `url` は絶対パスにした値） */
  htmlScripts: Record<string, unknown> | undefined;
  /** 範囲のスクリプトを集めるときの重ねた設定 */
  config: MdmarkConfig;
  /** 絶対パスのモジュールをまとめる関数 */
  bundle: BundleModules;
}): Promise<{
  libraries: Record<string, unknown> | undefined;
  htmlScripts: Record<string, unknown> | undefined;
  failures: Array<{ path: string; error: string }>;
}> {
  const { markdown, libraries, htmlScripts, config, bundle } = options;
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
  return {
    libraries: embeddedLibraries,
    htmlScripts: embeddedScripts,
    failures,
  };
}
