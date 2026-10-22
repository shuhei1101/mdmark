import type { ExportPayload } from "../cli/html.ts";
import type { MdmarkConfig } from "../config.ts";
import { type MdmarkExtension, registerExtension } from "../extensions.ts";
import { type PartName, setPartModuleUrl } from "../part-modules.ts";

/** 差し替えられる依存（単体テスト用） */
type ModuleDeps = {
  /** モジュールのコードから `blob:` URL を作る */
  createUrl: (code: string) => string;
  /** URL のモジュールを読む */
  importModule: (url: string) => Promise<{ default?: unknown }>;
  /** 拡張を登録する */
  register: (extension: MdmarkExtension) => void;
};

/** 埋めたコードのモジュールの種類 */
const MODULE_TYPE = "text/javascript";

/** 埋められなかった外部ライブラリの印の URL: 読むと例外を投げ、印の場所を知らせの枠にする（ページの隣のファイルへ要求を出さない） */
const UNAVAILABLE_MODULE =
  "data:text/javascript,throw%20new%20Error(%22not%20embedded%22)";

/** 部品のモジュールの名前。埋められなかった部品は、ページの隣の配布ファイルへ要求しないよう、読むと例外を投げる URL に替える */
const PART_NAMES: readonly PartName[] = ["view", "comments"];

/** 既定の依存: `URL.createObjectURL`・動的 `import()`・`registerExtension` */
const defaultDeps: ModuleDeps = {
  createUrl: (code) =>
    URL.createObjectURL(new Blob([code], { type: MODULE_TYPE })),
  importModule: (url) => import(/* @vite-ignore */ url),
  register: registerExtension,
};

/** 埋めた外部ライブラリのコードを `blob:` URL に替えて設定の `libraries` に入れ、埋めた部品のコードを `blob:` URL に替えて部品の読み込みに渡し（埋めなかった部品は読むと例外を投げる URL にする）、埋めた拡張を読んで `registerExtension` で登録し、`libraries` を替えた設定を返す */
export async function prepareModules(
  payload: Pick<ExportPayload, "config" | "modules" | "extensions" | "parts">,
  deps: ModuleDeps = defaultDeps,
): Promise<MdmarkConfig> {
  const libraries: Record<string, string> = {};
  for (const name of Object.keys(payload.config.libraries ?? {})) {
    libraries[name] = UNAVAILABLE_MODULE;
  }
  for (const [name, code] of Object.entries(payload.modules)) {
    libraries[name] = deps.createUrl(code);
  }
  for (const name of PART_NAMES) {
    const code = name === "view" ? payload.parts?.view : undefined;
    setPartModuleUrl(
      name,
      code === undefined ? UNAVAILABLE_MODULE : deps.createUrl(code),
    );
  }
  for (const code of payload.extensions) {
    // 読めない・登録できない拡張は飛ばし、ほかの拡張と描画は続ける（印は知らない印として取り除かれる）
    try {
      const module = await deps.importModule(deps.createUrl(code));
      deps.register(module.default as MdmarkExtension);
    } catch (error) {
      console.error("拡張を登録できません:", error);
    }
  }
  return { ...payload.config, libraries };
}
