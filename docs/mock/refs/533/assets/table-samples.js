// #533 の表の見本の定義（table-pin-fit.js が描く）。キーは #438 の table-samples.js と同じ。
// scroll の数値は、その列（0 始まり）の右端が表の見える範囲の右端に揃うまでスクロールした位置。notice は留まっていないことを示すボタンの見た目の案（a: ピンのアイコンを破線にする・b: 押した状態のピンの角に注意のマーカーを重ねる）

window.mdmarkMockTables533 = {};
{
  const T = window.mdmarkMockTables533;
  const head = [["文書の場所", "担当する人", "今の状態", "本文の行数", "表の数", "図の数", "Chrome の版", "Edge の版", "Firefox の版", "Safari の版"]];
  const body = [
    ["使い方/導入", "表の担当者", "未着手の状態", "120 行の本文", "3 つの表", "1 つの図", "Chrome 124", "Edge 124", "Firefox 128", "Safari 17.4"],
    ["使い方/書く", "コードの担当者", "進行中の状態", "340 行の本文", "12 の表", "4 つの図", "Chrome 124", "Edge 124", "Firefox 128", "Safari 17.4"],
    ["リファレンス/記法", "図の担当者", "完了の状態", "980 行の本文", "41 の表", "2 つの図", "Chrome 124", "Edge 124", "Firefox 128", "Safari 17.4"],
  ];

  T["each-a"] = { label: "1・3・9 列目を選び、9 列目が見える幅に収まらない表（案 A）", head, body, mode: "each", press: [2, 8], scroll: 8, notice: "a" };
  T["each-a-end"] = { label: "1・3・9 列目を選び、右端までスクロールした表（案 A）", head, body, mode: "each", press: [2, 8], scroll: "end", notice: "a" };
  T["each-b"] = { label: "1・3・9 列目を選び、9 列目が見える幅に収まらない表（案 B）", head, body, mode: "each", press: [2, 8], scroll: 8, notice: "b" };
  T["through-a"] = { label: "table.pin: through で 3 列目を押し、3 列目が見える幅に収まらない表（案 A）", head, body, mode: "through", press: [2], scroll: 2, notice: "a" };
  T["through-b"] = { label: "table.pin: through で 3 列目を押し、3 列目が見える幅に収まらない表（案 B）", head, body, mode: "through", press: [2], scroll: 2, notice: "b" };
  T["each-fit"] = { label: "1・3・9 列目を選び、全て見える幅に収まる表", head, body, mode: "each", press: [2, 8], scroll: "start", notice: "a" };
}
