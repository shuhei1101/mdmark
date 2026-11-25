// #811 の表の見本の定義（#449 の table-resize.js が描き、drag-alt.js がドラッグしない操作を付ける）。
// 書き方は #449 の table-samples.js と同じ。名前は 811- で始め、#449 の定義と重ねない

{
  const T = window.mdmarkMockTables449;
  const head = [["名前", "説明", "更新日"]];
  const body = [
    ["りんご", "描画を速くするために、見出しの列ごとの幅を描いた後に一度だけ測る", "2026-10-01"],
    ["みかん", "印刷を修正する", "2026-10-10"],
    ["りんご飴", "描画の崩れを修正する", "2026-10-20"],
  ];

  T["811-fine"] = { label: "細かいポインターの画面の、押せる範囲を 24px にしたつまみ", head, body, resize: true, wide: "説明", state: { 0: "hover" } };
  T["811-a"] = { label: "案 A: 見出しのメニューから列の幅を変える表", head, body, resize: true, wide: "説明" };
  T["811-b"] = { label: "案 B: つまみを押して開くメニューから列の幅を変える表", head, body, resize: true, wide: "説明" };
  T["811-b-min"] = { label: "案 B: 列の最小幅まで狭めてメニューを開いた表", head, body, resize: true, wide: "説明", widths: { 0: -2000 } };
  T["811-c"] = { label: "案 C: テーブル設定の列名の行から列の幅を変える表", head, body, resize: true, wide: "説明" };
}
