import { expect, test } from "vitest";

/** 変更履歴の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadModule = () => import("../../../../src/cli/changelog.ts");

/** 変更履歴の行を作る */
function row(version: string, pr: number, change: string): string {
  return `| ${version} | [#${pr}](https://github.com/shuhei1101/mdmark/blob/${version}/dev/pr/${pr}/README.md) | ${change} |`;
}

// 範囲のバージョンの行だけを表の並びで返却する（正常系）
test("test_changelog_rows", async () => {
  // 準備
  const { changelogRows } = await loadModule();
  const text = [
    "# 変更履歴",
    "",
    "バージョンごとの変更の一覧",
    "",
    "| バージョン | PR | 変更 |",
    "| --- | --- | --- |",
    row("v0.5.0", 45, "注意書きのマーカーの名前を統一する"),
    row("v0.4.0", 41, "表の列を追加する"),
    row("v0.4.0", 40, "バージョンを上げる mdmark upgrade を作る"),
    row("v0.3.0", 38, "手元のバージョンより古い行"),
    "",
  ].join("\n");
  // 実行
  const rows = changelogRows({ text, from: "v0.3.0", to: "v0.5.0" });
  // 検証
  expect(rows).toEqual([
    {
      version: "v0.5.0",
      pr: "#45",
      change: "注意書きのマーカーの名前を統一する",
    },
    { version: "v0.4.0", pr: "#41", change: "表の列を追加する" },
    {
      version: "v0.4.0",
      pr: "#40",
      change: "バージョンを上げる mdmark upgrade を作る",
    },
  ]);
});
