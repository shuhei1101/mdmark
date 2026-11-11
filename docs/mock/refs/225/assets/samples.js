// #225 の表の見本の定義（refs/151/assets/table-build.js が組み立てる）。refs/151/assets/samples.js の後、table-build.js の前に読む

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // 閉じた表: 3 行のリリース
  const releasesClosed = {
    label: "閉じた表",
    kind: "data",
    columns: [{ name: "バージョン" }, { name: "日付" }, { name: "内容" }],
    rows: [
      ["v0.1.0", "2026-10-10", "描く土台"],
      ["v0.2.0", "2026-11-04", "表と注意書き"],
      ["v0.2.1", "2026-11-12", "印刷の崩れの修正"],
    ],
  };

  // title= の開いた表: 2 行のリリース
  const releasesOpen = {
    label: "リリースの一覧",
    kind: "data",
    columns: [{ name: "バージョン" }, { name: "日付" }],
    rows: [
      ["v0.8.0", "2026-10-28"],
      ["v0.9.0", "2026-11-20"],
    ],
  };

  const tables = window.mdmarkMockTables;
  tables["releases-closed"] = releasesClosed;
  tables["releases-open"] = releasesOpen;
}
