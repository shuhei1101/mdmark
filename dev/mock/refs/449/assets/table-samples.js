// #449 の表の見本の定義（table-resize.js が描く）。head・body はマーカーの中の Markdown の表のセルの文字のまま。
// resize は列の幅のつまみを付けるか（-resize・plain は false）、pin は描いた後に留める列（0 始まり）、wide は wide= の列名、
// widths は描いた後に幅を変えておく列と増やす幅（px）、scroll は描いた後のスクロールの位置（start・end）、
// focus はつまみにフォーカスしておく列、state は見本で固定して見せるつまみの状態（hover・drag・open は「狭める」「広げる」のボタンを出した状態）、coarse はつまみを常に出す見本

window.mdmarkMockTables449 = {};
{
  const T = window.mdmarkMockTables449;
  const shortHead = [["名前", "説明", "更新日"]];
  const shortBody = [
    ["りんご", "描画を速くするために、見出しの列ごとの幅を描いた後に一度だけ測る", "2026-10-01"],
    ["みかん", "印刷を修正する", "2026-10-10"],
    ["りんご飴", "描画の崩れを修正する", "2026-10-20"],
  ];

  T.hover = { label: "名前の列の見出しの右端にポインターを乗せた表", head: shortHead, body: shortBody, resize: true, wide: "説明", state: { 0: "hover" } };
  T.drag = { label: "名前の列のつまみを右へ 80px ドラッグしている表", head: shortHead, body: shortBody, resize: true, wide: "説明", widths: { 0: 80 }, state: { 0: "drag" } };
  T.min = { label: "説明の列を列の最小幅まで狭めた表", head: shortHead, body: shortBody, resize: true, wide: "説明", widths: { 1: -2000 } };
  T.keyboard = { label: "名前の列のつまみにフォーカスし、→ キーで広げた表", head: shortHead, body: shortBody, resize: true, widths: { 0: 32 }, focus: 0 };
  T.buttons = { label: "名前の列のつまみを押して「狭める」「広げる」のボタンを出した表", head: shortHead, body: shortBody, resize: true, state: { 0: "open" } };
  T.coarse = { label: "ポインターが粗い画面でつまみを常に出した表", head: shortHead, body: shortBody, resize: true, coarse: true };
  T.off = { label: "-resize の表", head: shortHead, body: shortBody, resize: false };

  const wideHead = [["文書", "担当", "状態", "行数", "表", "図", "Chrome", "Edge", "Firefox", "Safari"]];
  const wideBody = [
    ["使い方/導入", "表", "未着手", "120", "3", "1", "124", "124", "128", "17.4"],
    ["使い方/書く", "コード", "進行中", "340", "12", "4", "124", "124", "128", "17.4"],
    ["リファレンス/記法", "図", "完了", "980", "41", "2", "124", "124", "128", "17.4"],
    ["リファレンス/設定", "表", "未着手", "260", "9", "0", "124", "124", "128", "17.4"],
  ];
  T["pinned-left"] = {
    label: "1 列目を 60px 広げ、3 列目と留めて右へスクロールした表",
    head: wideHead,
    body: wideBody,
    resize: true,
    pin: [0, 2, 8],
    widths: { 0: 60 },
    scroll: "end",
  };
  T["pinned-max"] = {
    label: "留めた 1 列目を、表の見える幅を超えるまで広げようとした表",
    head: wideHead,
    body: wideBody,
    resize: true,
    pin: [0, 2],
    widths: { 0: 2000 },
    scroll: "end",
  };
  T["pinned-right"] = {
    label: "右端に留めた 9 列目を 40px 広げた表",
    head: wideHead,
    body: wideBody,
    resize: true,
    pin: [0, 2, 8],
    widths: { 8: 40 },
    scroll: "start",
  };
}
