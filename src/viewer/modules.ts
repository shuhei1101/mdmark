import { type MdmarkExtension, registerExtension } from "../extensions.ts";
import { type EmbeddedSyntax, setEmbeddedSyntax } from "../highlight.ts";
import { setEmbeddedHtmlScripts } from "../html-scripts.ts";
import { type LibraryModule, setEmbeddedLibraries } from "../libraries.ts";
import { setEmbeddedMermaid } from "../mermaid.ts";
import { type PartName, setPartModuleLoader } from "../part-modules.ts";

/** CLI がまとめる入口のモジュールが `startViewer` に指定する、同じスクリプトにまとめた部品・色分け・外部ライブラリ・拡張のモジュール */
export type EmbeddedModules = {
  /** 静的な `import` で取り込んだ部品のモジュール。文書にビューのマーカーがあるときだけ `view` を持つ */
  parts: Partial<Record<PartName, Record<string, unknown>>>;
  /** 静的な `import` で取り込んだ色分けの本体と言語のモジュール。文書に色分けの対象があり本体をまとめられたときだけ持つ */
  syntax?: EmbeddedSyntax | undefined;
  /** 静的な `import` で取り込んだ mermaid のモジュールの名前空間。文書に mermaid のコードブロックがありまとめられたときだけ持つ */
  mermaid?: { default?: unknown } | undefined;
  /** マーカーの名前から、外部ライブラリのモジュールをリテラルの動的 `import()` で読み込む関数を参照する表 */
  libraries: Record<string, () => Promise<LibraryModule>>;
  /** 拡張のモジュールをリテラルの動的 `import()` で読み込む関数。設定の `extensions` の順 */
  extensions: Array<() => Promise<{ default?: unknown }>>;
  /** 範囲のコードの文字から、既定のエクスポートを返却する関数を参照する表（CLI が esbuild で変えてまとめたもの） */
  htmlScripts?: Map<string, () => unknown> | undefined;
};

/** 差し替えられる依存（単体テスト用） */
type ModuleDeps = {
  /** 拡張を登録する */
  register: (extension: MdmarkExtension) => void;
};

/** 部品のモジュールの名前。埋めなかった部品は、ページの隣の配布ファイルへ要求しないよう、呼ぶと拒否する関数を入れる */
const PART_NAMES: readonly PartName[] = ["view", "comments", "map"];

/** 既定の依存: `registerExtension` */
const defaultDeps: ModuleDeps = { register: registerExtension };

/** 埋めた部品・色分け・外部ライブラリを読み込みに指定し、拡張を 1 つずつ読み込んで `registerExtension` で登録する。`URL.createObjectURL` と URL を読み込む動的 `import()` を使用しない */
export async function prepareModules(
  embedded: EmbeddedModules,
  deps: ModuleDeps = defaultDeps,
): Promise<void> {
  for (const name of PART_NAMES) {
    const module = embedded.parts[name];
    setPartModuleLoader(name, () =>
      module === undefined
        ? Promise.reject(new Error(`埋めていない部品: ${name}`))
        : Promise.resolve(module),
    );
  }
  // 色分けを埋めていないときは本体を持たない値を入れ、jsDelivr へ要求しない（色分けせずに描く）
  setEmbeddedSyntax(embedded.syntax ?? { languages: {} });
  // 埋めなかったときも外へ読み込まず、mermaid のコードブロックは通知ブロックとコードブロックにする
  setEmbeddedMermaid(embedded.mermaid ?? {});
  setEmbeddedLibraries(embedded.libraries);
  // 範囲のスクリプトはまとめた関数だけを使用し、変換のライブラリを外へ要求しない（表に無い範囲は記載の警告になる）
  setEmbeddedHtmlScripts(embedded.htmlScripts ?? new Map());
  for (const load of embedded.extensions) {
    // 評価で例外を投げる・登録できない拡張は飛ばし、ほかの拡張と描画は続ける（マーカーは知らないマーカーとして取り除かれる）
    try {
      const module = await load();
      deps.register(module.default as MdmarkExtension);
    } catch (error) {
      console.error("拡張を登録できません:", error);
    }
  }
}
