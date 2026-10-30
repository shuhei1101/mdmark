// #225 の表の見本の定義（refs/151/assets/table-build.js が組み立てる）。refs/151/assets/samples.js の後、table-build.js の前に読む

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  // 語の欄と件数を持つ作業の表: 名前（文字で絞り込む）・説明・状態（値で絞り込む）
  const tasks = {
    label: "作業",
    kind: "data",
    features: { count: true },
    columns: [{ name: "名前", filter: "text" }, { name: "説明" }, { name: "状態", filter: "select" }],
    rows: [
      ["描画", "速くする", "済"],
      ["印刷", "描画の崩れを直す", "未"],
      ["索引", "点検を足す", "未"],
      ["書き出し", "描画を待つ", "済"],
      ["差分", "行の比べ方を変える", "未"],
      ["コメント", "保存できないことを知らせる", "済"],
      ["ツリー", "注釈の列を揃える", "未"],
      ["拡張", "登録の引数を検査する", "済"],
    ],
  };

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
  for (const key of ["tasks", "tasks-chips", "tasks-empty", "tasks-folded"]) tables[key] = tasks;
  tables["releases-closed"] = releasesClosed;
  tables["releases-open"] = releasesOpen;
}
