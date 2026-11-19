import {
  readSettings,
  type SettingsEngine,
  SettingsError,
} from "./settings.ts";

/** マーカーの記載方法の説明の文。600 文字以内 */
export const MARKER_GUIDE = [
  "mdmark-style: 返答の Markdown に次のマーカーを記載すると、Claude Code の画面で mdmark の共通スタイルで描きます。マーカーは画面に出ません。",
  '- 表の種類: 表を <!-- table: {"kind": "data"} --> 〜 <!-- /table --> で囲む',
  "- 注意書き: 引用の 1 行目を > [!NOTE]・[!TIP]・[!IMPORTANT]・[!WARNING]・[!CAUTION] にする",
  "- コードブロックの飾り: 直前に <!-- code: title=ファイル名 lines --> を記載し、行末に // [!code ++] などを付ける",
  "- 開閉の範囲: <!-- details: タイトル --> 〜 <!-- /details --> で囲む",
  "- ステップ: 番号付きリストを <!-- steps --> 〜 <!-- /steps --> で囲む",
  "- ファイルツリー: 言語 tree のコードブロックに ├── などの罫線で記載し、注釈は名前の後ろの 「 # 」に続ける",
  "- バッジ: 行内のコードを badge:green:完了 のように記載する",
].join("\n");

/** SessionStart で使用する `$` の機能 */
export type GuideEngine = SettingsEngine & {
  ui: { log: (text: string, options?: { to?: "debug" }) => void };
};

/** SessionStart の結果のうち、このフックが触るフィールド */
export type SessionStartResult = { additionalContext?: string[] } & Record<
  string,
  unknown
>;

/** `next(e)` の結果の `additionalContext` の後ろに `MARKER_GUIDE` を追加して返却する */
export async function injectMarkerGuide(
  $: GuideEngine,
  e: unknown,
  next: (e: unknown) => Promise<SessionStartResult>,
): Promise<SessionStartResult> {
  const result = await next(e);
  let enabled: boolean;
  try {
    enabled = (await readSettings($)).inject_marker_guide;
  } catch (error) {
    if (!(error instanceof SettingsError)) {
      throw error;
    }
    $.ui.log(error.message, { to: "debug" });
    return result;
  }
  if (!enabled) {
    return result;
  }
  return {
    ...result,
    additionalContext: [...(result.additionalContext ?? []), MARKER_GUIDE],
  };
}
