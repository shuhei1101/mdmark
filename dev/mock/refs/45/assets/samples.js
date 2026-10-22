// #45 で足す図の部品の定義の見本（文書に書く部品の定義と、埋め込んだ HTML の <mdmark-chart> の中身の JSON に当たる）。
// refs/42/assets/samples.js の後、diagram.js の前に読み、同じ見本の表へ足す

// 問い合わせの件数の棒のグラフ: 系列 2 つ・項目 4 つ。縦の軸の範囲を書かず、データから目盛りを切る
window.mdmarkMockDiagrams["inquiry-count"] = {
  kind: "chart",
  type: "bar",
  title: "窓口ごとの問い合わせの件数",
  scope: "10 月の第 2 週",
  updated: "2026-10-17",
  x: { label: "窓口", ticks: ["メール", "フォーム", "チャット", "電話"] },
  y: { label: "件" },
  series: [
    { name: "自動返信", points: [124, 86, 57, 12] },
    { name: "担当者", points: [38, 41, 63, 95] },
  ],
};

// 系列 4 つの棒のグラフ: 塗りの模様の組を 4 つとも見せる
window.mdmarkMockDiagrams["inquiry-count-4"] = {
  kind: "chart",
  type: "bar",
  title: "窓口ごとの問い合わせの件数（週ごと）",
  scope: "10 月",
  updated: "2026-10-31",
  x: { label: "窓口", ticks: ["メール", "フォーム", "チャット", "電話"] },
  y: { label: "件" },
  series: [
    { name: "第 1 週", points: [118, 80, 49, 15] },
    { name: "第 2 週", points: [124, 86, 57, 12] },
    { name: "第 3 週", points: [131, 92, 61, 18] },
    { name: "第 4 週", points: [109, 77, 70, 9] },
  ],
};

// 返信の種類の割合の円のグラフ: 項目 3 つ
window.mdmarkMockDiagrams["reply-kind"] = {
  kind: "chart",
  type: "pie",
  title: "返信の種類の割合",
  scope: "10 月の第 2 週",
  updated: "2026-10-17",
  unit: " 件",
  items: [
    { name: "よくある質問で答えた", value: 186 },
    { name: "担当者へ回した", value: 92 },
    { name: "返信しなかった", value: 22 },
  ],
};

// 本文の長さと返信までの時間の散布図: 系列 2 つ・点 6 つずつ。横と縦の両方を数値の軸にし、範囲はデータから切る
window.mdmarkMockDiagrams["length-time"] = {
  kind: "chart",
  type: "scatter",
  title: "本文の長さと返信までの時間",
  scope: "10 月の第 2 週",
  updated: "2026-10-17",
  x: { label: "本文の長さ（字）" },
  y: { label: "分" },
  series: [
    { name: "自動返信", points: [[120, 6], [260, 9], [410, 11], [580, 14], [730, 13], [900, 18]] },
    { name: "担当者", points: [[150, 28], [300, 35], [450, 41], [620, 39], [800, 52], [960, 58]] },
  ],
};

// 箱の hint を持つフロー図: 問い合わせの自動返信の構成の「窓口の MCP」に、io を持たない hint だけを足す
window.mdmarkMockDiagrams["inquiry-hint"] = {
  ...window.mdmarkMockDiagrams.inquiry,
  nodes: window.mdmarkMockDiagrams.inquiry.nodes.map((node) =>
    node.id === "mcp" ? { ...node, hint: "保存と送信のツールだけを持つ MCP サーバー。メールの本文は読まず、下書きの ID で頼まれた操作をする" } : node,
  ),
};
