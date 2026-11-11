// #283 の表の見本の定義（table-pin.js が描く）。head・body はマーカーの中の Markdown の表のセルの文字のまま。
// pinned は既定で留める列の数（はみ出す表の先頭の列。-pin は 0）、noPin は -pin、pin・wide・check は pin=・wide=・check= の列名

window.mdmarkMockTables283 = {};
{
  const T = window.mdmarkMockTables283;
  const browserHead = [["文書", "行数", "表", "図", "Chrome", "Edge", "Firefox", "Safari", "iOS Safari", "Android Chrome"]];
  const browserBody = [
    ["使い方/導入", "120", "3", "1", "124", "124", "128", "17.4", "17.4", "124"],
    ["使い方/書く", "340", "12", "4", "124", "124", "128", "17.4", "17.4", "124"],
    ["リファレンス/記法", "980", "41", "2", "124", "124", "128", "17.4", "17.4", "124"],
    ["リファレンス/設定", "260", "9", "0", "124", "124", "128", "17.4", "17.4", "124"],
  ];
  T["default-pin"] = { label: "はみ出す表の既定のピン止め", head: browserHead, body: browserBody, pinned: 1 };
  T["no-pin"] = { label: "-pin でピン止めを外した表", head: browserHead, body: browserBody, pinned: 0, noPin: true };

  T["pin-wide"] = {
    label: "pin=担当 wide=概要",
    head: [["ID", "担当", "概要", "状態", "期限"]],
    body: [
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

  T["unknown-column"] = {
    label: "知らない列名",
    head: [["キー", "型", "必須", "既定"]],
    body: T.check.body,
    warning:
      "<code>&lt;!-- table: check=必要 wide=説明 --&gt;</code> の列名 <code>必要</code>・<code>説明</code> は、この表にありません。列名はキー・型・必須・既定です。この 2 つの指定を無視して描いています。",
  };
}
