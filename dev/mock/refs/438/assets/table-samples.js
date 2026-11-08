// #438 の表の見本の定義（table-pin-each.js が描く）。head・body はマーカーの中の Markdown の表のセルの文字のまま（<< を含む）。
// mode は設定の table.pin（each・through）、pin は pin= の列名の並び、wide は wide= の列名、press は描いた後に押した列（0 始まり）、scroll は描いた後のスクロールの位置（start・end）、warning は書き方の警告

window.mdmarkMockTables438 = {};
{
  const T = window.mdmarkMockTables438;
  const wideHead = [["文書", "担当", "状態", "行数", "表", "図", "Chrome", "Edge", "Firefox", "Safari"]];
  const wideBody = [
    ["使い方/導入", "表", "未着手", "120", "3", "1", "124", "124", "128", "17.4"],
    ["使い方/書く", "コード", "進行中", "340", "12", "4", "124", "124", "128", "17.4"],
    ["リファレンス/記法", "図", "完了", "980", "41", "2", "124", "124", "128", "17.4"],
    ["リファレンス/設定", "表", "未着手", "260", "9", "0", "124", "124", "128", "17.4"],
  ];

  T["each-left"] = { label: "3 列目を押して右へスクロールした表", head: wideHead, body: wideBody, mode: "each", press: [2], scroll: "end" };
  T["each-right"] = { label: "8 列目と 9 列目を押して左端へ戻した表", head: wideHead, body: wideBody, mode: "each", press: [2, 7, 8], scroll: "start" };
  T.through = { label: "table.pin: through で 3 列目を押した表", head: wideHead, body: wideBody, mode: "through", press: [2], scroll: "end" };

  const keyHead = [["No", "物理名", "論理名", "型", "必須", "既定", "説明", "例"]];
  const keyBody = [
    ["1", "features.table", "表の機能", "boolean", "false", "true", "表のマーカーと、マーカーで囲まない表に、種類ごとの並べ替え・ピン止め・絞り込みを付ける", "true"],
    ["2", "table.pin", "ピン止めの動き", "string", "false", "each", "each は押した列だけを留め、through は押した列までを留める", "through"],
    ["3", "side-toc.mode", "右側の目次の出し方", "string", "false", "hover", "hover は右端の線を出し、fixed は目次を出すボタンでサイドバーを開閉する", "fixed"],
  ];
  T["pin-one"] = { label: "pin=物理名", head: keyHead, body: keyBody, mode: "each", pin: ["物理名"], scroll: "end" };
  T["pin-many"] = { label: "pin=No,物理名", head: keyHead, body: keyBody, mode: "each", pin: ["No", "物理名"], scroll: "end" };
  T["pin-unknown"] = {
    label: "pin=物理名,無い列",
    head: keyHead,
    body: keyBody,
    mode: "each",
    pin: ["物理名", "無い列"],
    scroll: "end",
    warning: "<code>pin=</code> の列名 <code>無い列</code> が見出しにありません。見出しの列名を記載してください。",
  };

  T.merged = {
    label: "header-rows=2 wide=備考 で既定の列だけを押した表",
    head: [
      ["名前", "設定", "<<", "<<", "備考"],
      ["名前", "型", "既定", "必須", "備考"],
    ],
    body: [
      ["table.pin", "string", "each", "false", "each は押した列だけを留め、through は押した列までを留める。既定は each"],
      ["side-toc.mode", "string", "hover", "false", "hover は右端の線を出し、fixed は目次を出すボタンでサイドバーを開閉する"],
    ],
    mode: "each",
    wide: "備考",
    press: [2],
    scroll: "end",
  };
}
