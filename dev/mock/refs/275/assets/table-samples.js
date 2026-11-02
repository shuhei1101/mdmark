// #275 の表の見本の定義（table-merge.js が描く）。head・body はマーカーの中の Markdown の表のセルの文字のまま（^^・<< を含む）。
// rowHeader は row-header=N、pinned は既定で留める列の数（はみ出す表の先頭の列・行見出しの列まで。-pin は 0）、
// noPin は -pin、pin・wide・check は pin=・wide=・check= の列名、sorted・filter はモックで見せる並べ替え・絞り込みの後の状態

window.mdmarkMockTables275 = {};
{
  const T = window.mdmarkMockTables275;
  const salesHead = [
    ["地域", "支店", "上期", "<<", "下期", "<<"],
    ["^^", "^^", "売上（万円）", "件数", "売上（万円）", "件数"],
  ];
  const salesBody = [
    ["東日本", "札幌", "120", "14", "135", "16"],
    ["^^", "仙台", "98", "11", "102", "12"],
    ["^^", "東京", "310", "40", "342", "45"],
    ["西日本", "大阪", "260", "31", "248", "29"],
    ["^^", "福岡", "140", "17", "151", "19"],
  ];
  T.merge = { label: "多段の見出しと行見出し", head: salesHead, body: salesBody, rowHeader: 1, pinned: 1 };
  T["merge-sorted"] = { ...T.merge, label: "下期の売上で降順に並べ替えた後", sorted: { col: 4, direction: "descending" } };
  T["merge-filtered"] = { ...T.merge, label: "地域を東日本で絞り込んだ後", filter: { col: 0, value: "東日本" } };

  const browserHead = [["文書", "行数", "表", "図", "Chrome", "Edge", "Firefox", "Safari", "iOS Safari", "Android Chrome"]];
  const browserBody = [
    ["使い方/導入", "120", "3", "1", "124", "124", "128", "17.4", "17.4", "124"],
    ["使い方/書く", "340", "12", "4", "124", "124", "128", "17.4", "17.4", "124"],
    ["リファレンス/記法", "980", "41", "2", "124", "124", "128", "17.4", "17.4", "124"],
    ["リファレンス/設定", "260", "9", "0", "124", "124", "128", "17.4", "17.4", "124"],
  ];
  T["default-pin"] = { label: "はみ出す表の既定のピン止め", head: browserHead, body: browserBody, pinned: 1 };
  T["no-pin"] = { label: "-pin でピン止めを外した表", head: browserHead, body: browserBody, pinned: 0, noPin: true };

  T["row-header-pin"] = {
    label: "row-header=2 のはみ出す表",
    head: [["分類", "記法", "Chrome", "Edge", "Firefox", "Safari", "iOS Safari", "Android Chrome", "VS Code", "書き出した HTML"]],
    body: [
      ["表", "セルの結合", "124", "124", "128", "17.4", "17.4", "124", "1.95", "対応"],
      ["^^", "既定のピン止め", "124", "124", "128", "17.4", "17.4", "124", "1.95", "対応"],
      ["^^", "真偽値の ✓", "124", "124", "128", "17.4", "17.4", "124", "1.95", "対応"],
      ["コード", "折りたたみ", "124", "124", "128", "17.4", "17.4", "124", "1.95", "対応"],
      ["^^", "インデントの縦線", "124", "124", "128", "17.4", "17.4", "124", "1.95", "対応"],
    ],
    rowHeader: 2,
    pinned: 2,
  };

  T["pin-wide"] = {
    label: "pin=担当 wide=概要",
    head: [["ID", "担当", "概要", "状態", "期限"]],
    body: [
      ["#183", "表", "header-rows=N と row-header=N で多段の見出しと行見出しを描き、^^ と << でセルを結合する。並べ替えと絞り込みの後は隣り合う同じ値だけを結合し直す", "対応中", "2026-11-14"],
      ["#245", "表", "はみ出す表で先頭の列を既定でピン止めし、pin= と wide= と check= を使えるようにする", "未着手", "2026-11-21"],
      ["#249", "コード", "tree を除く全てのコードブロックでインデントによる畳む・開くと縦線を付ける", "未着手", "2026-11-28"],
    ],
    pin: "担当",
    pinned: 2,
    wide: "概要",
  };

  T.check = {
    label: "check=必須",
    head: [["キー", "型", "必須", "既定"]],
    body: [
      ["version", "string", "true", "-"],
      ["features", "object", "false", "全てオン"],
      ["libraries", "object", "false", "jsDelivr"],
      ["build", "array", "true", "-"],
    ],
    check: "必須",
  };

  T["merge-warning"] = {
    label: "読めないセルの結合",
    head: [["地域", "支店", "売上（万円）"]],
    body: [
      ["^^", "札幌", "120"],
      ["<<", "仙台", "98"],
      ["東日本", "東京", "310"],
    ],
    warning:
      "1 行目の地域のセルの <code>^^</code> は、上に結合するセルがありません。2 行目の地域のセルの <code>&lt;&lt;</code> は、左に結合するセルがありません。どちらも結合せず、書いた文字のまま描いています。",
  };

  T["unknown-column"] = {
    label: "知らない列名",
    head: [["キー", "型", "必須", "既定"]],
    body: T.check.body,
    warning:
      "<code>&lt;!-- table: check=必要 wide=説明 --&gt;</code> の列名 <code>必要</code>・<code>説明</code> は、この表にありません。列名はキー・型・必須・既定です。この 2 つの指定を無視して描いています。",
  };
}
