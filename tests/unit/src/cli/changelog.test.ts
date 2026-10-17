import { expect, test } from "vitest";

/** 変更履歴の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadModule = () => import("../../../../src/cli/changelog.ts");

/** 変更履歴の行を作る */
function row(version: string, pr: number, change: string): string {
  return `| ${version} | [#${pr}](https://github.com/shuhei1101/mdmark/blob/${version}/dev/pr/${pr}/README.md) | ${change} |`;
}

// 範囲の版の行だけを表の並びで返す（正常系）
test("test_changelog_rows", async () => {
  // 準備
  const { changelogRows } = await loadModule();
  const text = [
    "# 変更履歴",
    "",
    "版ごとの変更の一覧",
    "",
    "| バージョン | PR | 変更 |",
    "| --- | --- | --- |",
    row("v0.5.0", 45, "注意書きの印の名前を揃える"),
    row("v0.4.0", 41, "表の列を足す"),
    row("v0.4.0", 40, "版を上げる mdmark upgrade を作る"),
    row("v0.3.0", 38, "手元の版より古い行"),
    "",
  ].join("\n");
  // 実行
  const rows = changelogRows({ text, from: "v0.3.0", to: "v0.5.0" });
  // 検証
  expect(rows).toEqual([
    { version: "v0.5.0", pr: "#45", change: "注意書きの印の名前を揃える" },
    { version: "v0.4.0", pr: "#41", change: "表の列を足す" },
    {
      version: "v0.4.0",
      pr: "#40",
      change: "版を上げる mdmark upgrade を作る",
    },
  ]);
});
