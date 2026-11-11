// #308 で追加する図の定義の見本: グループ（システムの枠・層）の hint・タイトルを留めない図・縦に長い図・ノードと線の種類が 1 つずつの図。
// refs/42/assets/samples.js の後、diagram.js の前に読む

// グループの hint を持つ構成図: システムの枠と LLM の層に hint を持たせる（処理・データの層は持たない）
window.mdmarkMockDiagrams["inquiry-groups"] = {
  ...window.mdmarkMockDiagrams.inquiry,
  frame: { ...window.mdmarkMockDiagrams.inquiry.frame, hint: "メールの受け取りから返信までを受け持つ範囲。担当者のチャットとメールサーバーは窓口の外にある" },
  lanes: window.mdmarkMockDiagrams.inquiry.lanes.map((lane) => (lane.kind === "llm" ? { ...lane, hint: "返信の種類を選び、下書きを書く。ここだけが外部のモデルを呼ぶ" } : lane)),
};

// 同じ図で、グループのタイトルを上端に留めない（定義の stickyTitles: false）
window.mdmarkMockDiagrams["inquiry-groups-off"] = { ...window.mdmarkMockDiagrams["inquiry-groups"], stickyTitles: false };

// 縦に長い構成図: 幅は表示枠に収まり、全体が収まる高さが --mdmark-diagram-max-height（36rem）を超える
window.mdmarkMockDiagrams["tall-flow"] = {
  kind: "flow",
  title: "問い合わせを受けてから記録するまでの手順",
  scope: "1 通の問い合わせ",
  updated: "2026-11-04",
  width: 560,
  height: 1080,
  frame: { title: "問い合わせ窓口", x: 40, y: 20, w: 480, h: 1040, hint: "受け取りから記録までの 1 通ぶんの流れ" },
  lanes: [
    { label: "LLM", kind: "llm", y: 56, h: 320 },
    { label: "処理", kind: "script", y: 376, h: 360 },
    { label: "データ", kind: "data", y: 736, h: 312 },
  ],
  nodes: [
    { id: "t-read", kind: "llm", x: 200, y: 100, w: 160, h: 64, name: "本文を読む", sub: "要点を取り出す" },
    { id: "t-kind", kind: "llm", x: 200, y: 250, w: 160, h: 64, name: "種類を選ぶ", sub: "返信か担当者か" },
    { id: "t-draft", kind: "script", x: 200, y: 420, w: 160, h: 64, name: "下書きを作る", sub: "ひな形に当てる" },
    { id: "t-send", kind: "script", x: 200, y: 600, w: 160, h: 64, name: "送信", sub: "宛先へ返す" },
    { id: "t-log", kind: "data", shape: "db", x: 200, y: 800, w: 160, h: 64, name: "対応の記録", sub: "日時と担当" },
    { id: "t-faq", kind: "data", shape: "db", x: 200, y: 940, w: 160, h: 64, name: "よくある質問", sub: "質問と答え" },
  ],
  wires: [
    { id: "t-w1", line: "flow", points: [[280, 164], [280, 250]], label: "要点", labelAt: [280, 207] },
    { id: "t-w2", line: "flow", points: [[280, 314], [280, 420]], label: "種類", labelAt: [280, 367] },
    { id: "t-w3", line: "flow", points: [[280, 484], [280, 600]], label: "下書き", labelAt: [280, 542] },
    { id: "t-w4", line: "write", points: [[280, 664], [280, 800]], label: "記録する", labelAt: [280, 732] },
    { id: "t-w5", line: "read", points: [[360, 972], [440, 972], [440, 452], [360, 452]], label: "答えの候補", labelAt: [440, 712] },
  ],
};

// ノードの種類と線の種類が 1 つずつの図: 凡例に載せる項目が無い
window.mdmarkMockDiagrams["single-kinds"] = {
  kind: "flow",
  title: "下書きを確認する順番",
  scope: "送信の前",
  updated: "2026-11-04",
  width: 640,
  height: 120,
  nodes: [
    { id: "s-1", kind: "script", x: 24, y: 28, w: 160, h: 64, name: "宛先を確認する" },
    { id: "s-2", kind: "script", x: 240, y: 28, w: 160, h: 64, name: "本文を確認する" },
    { id: "s-3", kind: "script", x: 456, y: 28, w: 160, h: 64, name: "添付を確認する" },
  ],
  wires: [
    { id: "s-w1", line: "flow", points: [[184, 60], [240, 60]] },
    { id: "s-w2", line: "flow", points: [[400, 60], [456, 60]] },
  ],
};
