// 図の部品の定義の見本（文書に書く部品の定義の JSON に当たる）。diagram.js が data-mock-diagram の名前で引いて描く。
// 座標は図の中の px。箱の補足・種類の名前の {{語}} は用語集の語で、本文の用語と同じ破線の下線とツールチップを付ける

window.mdmarkMockGlossary = {
  意思決定モデル: "選択肢から選ぶ・当てはまるかに答えるだけの、速く安い判断用の AI",
  よくある質問: "問い合わせの多い質問と、その答えをまとめた表",
};

window.mdmarkMockDiagrams = {
  // 問い合わせの自動返信の構成図: 枠と 3 層・外部のシステム・line jump 1 か所・ループの戻り 1 本
  inquiry: {
    kind: "flow",
    title: "問い合わせへの自動返信の構成",
    scope: "メールを受け取ってから返信するまで",
    updated: "2026-10-17",
    width: 1100,
    height: 560,
    frame: { title: "問い合わせ窓口（自動返信のシステム）", x: 140, y: 20, w: 810, h: 520 },
    lanes: [
      { label: "LLM・意思決定モデル", kind: "llm", y: 56, h: 124 },
      { label: "処理（MCP・スクリプト）", kind: "mcp", y: 180, h: 140 },
      { label: "データ", kind: "data", y: 320, h: 136 },
    ],
    nodes: [
      { id: "mail", kind: "external", x: 12, y: 218, w: 116, h: 64, tag: "外部", name: "メールサーバー" },
      {
        id: "recv",
        kind: "script",
        x: 250,
        y: 218,
        w: 140,
        h: 64,
        name: "受け取り",
        sub: "1 通ずつ読む",
        io: { in: "問い合わせのメール", do: "件名・本文・送り主を取り出し、表に保存してから分類へ回す", out: "本文と、問い合わせの表の行" },
      },
      {
        id: "classify",
        kind: "dm",
        x: 410,
        y: 88,
        w: 140,
        h: 64,
        tag: "{{意思決定モデル}}",
        name: "分類",
        sub: "返信の種類を選ぶ",
        io: { in: "問い合わせの本文", do: "返信の種類（よくある質問で答える・担当者へ回す）から 1 つ選ぶ", out: "返信の種類と、その確からしさ" },
      },
      {
        id: "draft",
        kind: "llm",
        x: 630,
        y: 88,
        w: 140,
        h: 64,
        name: "返信の下書き",
        sub: "{{よくある質問}}から書く",
        io: { in: "本文・返信の種類・答えの候補", do: "答えの候補から返信の下書きを書き、保存のツールを呼ぶ", out: "下書きの本文とツールの呼び出し" },
      },
      { id: "mcp", kind: "mcp", x: 410, y: 218, w: 140, h: 64, name: "窓口の MCP", sub: "保存・送信を頼む" },
      {
        id: "send",
        kind: "script",
        x: 780,
        y: 218,
        w: 140,
        h: 64,
        name: "送信",
        sub: "宛先へ返す",
        io: { in: "送信の依頼（下書きの ID）", do: "下書きを宛先へ送り、担当者のチャットへ控えを流す", out: "送ったメールと控え" },
      },
      { id: "table", kind: "data", shape: "db", x: 300, y: 358, w: 140, h: 64, name: "問い合わせの表", sub: "状態つき" },
      { id: "faq", kind: "data", shape: "db", x: 630, y: 358, w: 140, h: 64, name: "よくある質問", sub: "質問と答え" },
      { id: "chat", kind: "external", x: 976, y: 218, w: 112, h: 64, tag: "外部", name: "担当者のチャット" },
    ],
    wires: [
      { id: "w-mail", line: "flow", points: [[128, 250], [250, 250]], label: "メール", labelAt: [189, 250], tip: "件名・本文・送り主のアドレス" },
      { id: "w-body", line: "flow", points: [[320, 218], [320, 120], [410, 120]], label: "本文", labelAt: [320, 168], tip: "件名を除いた本文。署名と引用は落とす" },
      { id: "w-save", line: "write", points: [[370, 282], [370, 358]], label: "保存", labelAt: [370, 320] },
      { id: "w-kind", line: "flow", points: [[550, 120], [630, 120]], label: "種類", labelAt: [590, 120] },
      { id: "w-tool", line: "flow", points: [[660, 152], [660, 190], [500, 190], [500, 218]], label: "ツールを呼ぶ", labelAt: [580, 190], tip: "下書きの本文・宛先・返信の種類" },
      { id: "w-faq", line: "read", points: [[720, 358], [720, 152]], label: "答えの候補", labelAt: [720, 322], tip: "質問に近い答え 3 件と、その見出し" },
      { id: "w-send", line: "flow", points: [[550, 250], [780, 250]], label: "送信の依頼", labelAt: [620, 250] },
      { id: "w-done", line: "write", points: [[480, 282], [480, 390], [440, 390]], label: "返信済みにする", labelAt: [480, 330] },
      { id: "w-chat", line: "flow", points: [[920, 250], [976, 250]], label: "控え", labelAt: [948, 250], tip: "返信の本文と宛先" },
      { id: "w-loop", line: "loop", points: [[850, 282], [850, 497], [270, 497], [270, 282]], label: "次の問い合わせへ（受け取りへ戻る）", labelAt: [560, 497] },
    ],
  },

  // 箱の名前が長いフロー図: 名前と補足を箱の中で折り返す
  "long-names": {
    kind: "flow",
    title: "問い合わせの添付ファイルを確かめてから担当者の確認待ちの一覧へ回すまでの流れ（添付のある問い合わせだけ）",
    scope: "添付ファイルのある問い合わせ",
    updated: "2026-10-17",
    width: 760,
    height: 200,
    nodes: [
      { id: "a", kind: "script", x: 16, y: 48, w: 190, h: 104, name: "添付ファイルの形式と大きさの確かめ", sub: "PDF・画像・表計算のファイルだけを通し、10 MB を超えるものは落とす" },
      { id: "b", kind: "llm", x: 286, y: 48, w: 190, h: 104, name: "添付の中身の要約", sub: "担当者が開かずに判断できるよう 3 行にまとめる" },
      { id: "c", kind: "data", shape: "db", x: 556, y: 48, w: 190, h: 104, name: "担当者の確認待ちの一覧（添付つき）", sub: "要約と元のファイルへのリンク" },
    ],
    wires: [
      { id: "l-ab", line: "flow", points: [[206, 100], [286, 100]], label: "通したファイル", labelAt: [246, 76] },
      { id: "l-bc", line: "write", points: [[476, 100], [556, 100]], label: "要約", labelAt: [516, 76] },
    ],
  },

  // 問い合わせの 1 回の流れのシーケンス図: 相手を左から右へ、メッセージを時刻の順に。ループの戻りを右の帯で 1 へ戻す
  "inquiry-seq": {
    kind: "sequence",
    title: "問い合わせ 1 通の流れ",
    scope: "受け取りから下書きの保存まで",
    updated: "2026-10-17",
    participants: [
      { id: "mail", kind: "external", tag: "外部", name: "メールサーバー" },
      { id: "recv", kind: "script", name: "受け取り" },
      { id: "classify", kind: "dm", tag: "{{意思決定モデル}}", name: "分類" },
      { id: "draft", kind: "llm", name: "返信の下書き" },
      { id: "mcp", kind: "mcp", name: "窓口の MCP" },
    ],
    steps: [
      { from: "mail", to: "recv", label: "問い合わせのメール", tip: "件名・本文・送り主のアドレス" },
      { from: "recv", to: "classify", label: "本文" },
      { from: "classify", to: "recv", label: "返信の種類", reply: true },
      { from: "recv", to: "draft", label: "本文と種類", tip: "本文・返信の種類・答えの候補 3 件" },
      { from: "draft", to: "mcp", label: "下書きを保存する" },
      { from: "mcp", to: "draft", label: "保存した下書きの ID", reply: true },
    ],
    loop: { label: "1 へ戻る（次の問い合わせ）" },
  },

  // 返信までの時間のグラフ: 系列 2 つ・点 5 つずつ
  "reply-time": {
    kind: "chart",
    title: "返信までの時間",
    scope: "10 月の第 2 週",
    updated: "2026-10-17",
    x: { label: "曜日", ticks: ["月", "火", "水", "木", "金"] },
    y: { label: "分", min: 0, max: 60, step: 15 },
    series: [
      { name: "自動返信", points: [12, 9, 14, 8, 10] },
      { name: "担当者", points: [42, 38, 51, 35, 44] },
    ],
  },

  // 系列 4 つのグラフ: 色と模様の組を 4 つとも見せる
  "reply-time-4": {
    kind: "chart",
    title: "返信までの時間（窓口ごと）",
    scope: "10 月の第 2 週",
    updated: "2026-10-17",
    x: { label: "曜日", ticks: ["月", "火", "水", "木", "金"] },
    y: { label: "分", min: 0, max: 60, step: 15 },
    series: [
      { name: "自動返信", points: [12, 9, 14, 8, 10] },
      { name: "担当者", points: [42, 38, 51, 35, 44] },
      { name: "夜間の窓口", points: [25, 30, 22, 27, 33] },
      { name: "電話の折り返し", points: [55, 48, 57, 50, 46] },
    ],
  },
};

// 操作できる部品の見本: スライダー 1 つ（0〜10、既定 5）と、その値で線を引くグラフ
window.mdmarkMockParams = {
  strength: {
    title: "返信の速さの見積もり",
    knob: { key: "strength", label: "反応の強さ", min: 0, max: 10, step: 1, value: 5 },
    chart: {
      title: "反応の強さごとの返信の進み",
      scope: "経過 0〜10 秒",
      updated: "2026-10-17",
      x: { label: "経過（秒）", ticks: ["0", "2", "4", "6", "8", "10"] },
      y: { label: "返信の進み（%）", min: 0, max: 100, step: 25 },
    },
  },
};
