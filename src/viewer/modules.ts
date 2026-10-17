import type { ExportPayload } from "../cli/html.ts";
import type { MdmarkConfig } from "../config.ts";
import { type MdmarkExtension, registerExtension } from "../extensions.ts";

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

/** 既定の依存: `URL.createObjectURL`・動的 `import()`・`registerExtension` */
const defaultDeps: ModuleDeps = {
  createUrl: (code) =>
    URL.createObjectURL(new Blob([code], { type: MODULE_TYPE })),
  importModule: (url) => import(/* @vite-ignore */ url),
  register: registerExtension,
};

/** 埋めた外部ライブラリのコードを `blob:` URL に替えて設定の `libraries` に入れ、埋めた拡張を読んで `registerExtension` で登録し、`libraries` を替えた設定を返す */
export async function prepareModules(
  payload: Pick<ExportPayload, "config" | "modules" | "extensions">,
  deps: ModuleDeps = defaultDeps,
): Promise<MdmarkConfig> {
  const libraries = { ...payload.config.libraries };
  for (const [name, code] of Object.entries(payload.modules)) {
    libraries[name] = deps.createUrl(code);
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
