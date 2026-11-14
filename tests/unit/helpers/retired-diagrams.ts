/** 廃止した `flow`・`sequence` の範囲に記載していた定義（変換と廃止の警告のテストが読む） */

/** 使用方法『図を描く-見本』に記載していたフロー図の定義（モックの `inquiry`）の JSON */
export const INQUIRY_TEXT: string = `{
  "title": "問い合わせへの自動返信の構成",
  "scope": "メールを受け取ってから返信するまで",
  "updated": "2026-10-17",
  "width": 1100,
  "height": 560,
  "frame": { "title": "問い合わせ窓口（自動返信のシステム）", "x": 140, "y": 20, "w": 810, "h": 520 },
  "lanes": [
    { "label": "LLM・意思決定モデル", "kind": "llm", "y": 56, "h": 124 },
    { "label": "処理（MCP・スクリプト）", "kind": "mcp", "y": 180, "h": 140 },
    { "label": "データ", "kind": "data", "y": 320, "h": 136 }
  ],
  "nodes": [
    { "id": "mail", "kind": "external", "x": 12, "y": 218, "w": 116, "h": 64, "tag": "外部", "name": "メールサーバー" },
    {
      "id": "recv", "kind": "script", "x": 250, "y": 218, "w": 140, "h": 64, "name": "受け取り", "sub": "1 通ずつ読み込む",
      "io": { "in": "問い合わせのメール", "do": "件名・本文・送信者を取り出し、表に保存してから分類へ回す", "out": "本文と、問い合わせの表の行" }
    },
    {
      "id": "classify", "kind": "dm", "x": 410, "y": 88, "w": 140, "h": 64, "tag": "{{意思決定モデル}}", "name": "分類", "sub": "返信の種類を選ぶ",
      "io": { "in": "問い合わせの本文", "do": "返信の種類（よくある質問で回答する・担当者へ回す）から 1 つ選ぶ", "out": "返信の種類と、その確からしさ" }
    },
    {
      "id": "draft", "kind": "llm", "x": 630, "y": 88, "w": 140, "h": 64, "name": "返信の下書き", "sub": "{{よくある質問}}から作成",
      "io": { "in": "本文・返信の種類・回答の候補", "do": "回答の候補から返信の下書きを作成し、保存のツールを呼ぶ", "out": "下書きの本文とツールの呼び出し" }
    },
    { "id": "mcp", "kind": "mcp", "x": 410, "y": 218, "w": 140, "h": 64, "name": "窓口の MCP", "sub": "保存・送信を頼む" },
    {
      "id": "send", "kind": "script", "x": 780, "y": 218, "w": 140, "h": 64, "name": "送信", "sub": "宛先へ返信する",
      "io": { "in": "送信の依頼（下書きの ID）", "do": "下書きを宛先へ送信し、担当者のチャットへ記録を送信する", "out": "送信したメールと記録" }
    },
    { "id": "table", "kind": "data", "x": 300, "y": 358, "w": 140, "h": 64, "name": "問い合わせの表", "sub": "状態つき" },
    { "id": "faq", "kind": "data", "x": 630, "y": 358, "w": 140, "h": 64, "name": "よくある質問", "sub": "質問と回答" },
    { "id": "chat", "kind": "external", "x": 976, "y": 218, "w": 112, "h": 64, "tag": "外部", "name": "担当者のチャット" }
  ],
  "wires": [
    { "id": "w-mail", "from": "mail", "to": "recv", "line": "flow", "points": [[128, 250], [250, 250]], "label": "メール", "labelAt": [189, 250], "tip": "件名・本文・送信者のアドレス" },
    { "id": "w-body", "from": "recv", "to": "classify", "line": "flow", "points": [[320, 218], [320, 120], [410, 120]], "label": "本文", "labelAt": [320, 168], "tip": "件名を除いた本文。署名と引用は落とす" },
    { "id": "w-save", "from": "recv", "to": "table", "line": "write", "points": [[370, 282], [370, 358]], "label": "保存", "labelAt": [370, 320] },
    { "id": "w-kind", "from": "classify", "to": "draft", "line": "flow", "points": [[550, 120], [630, 120]], "label": "種類", "labelAt": [590, 120] },
    { "id": "w-tool", "from": "draft", "to": "mcp", "line": "flow", "points": [[660, 152], [660, 190], [500, 190], [500, 218]], "label": "ツールを呼ぶ", "labelAt": [580, 190], "tip": "下書きの本文・宛先・返信の種類" },
    { "id": "w-faq", "from": "faq", "to": "draft", "line": "read", "points": [[720, 358], [720, 152]], "label": "回答の候補", "labelAt": [720, 322], "tip": "質問に近い回答 3 件と、その見出し" },
    { "id": "w-send", "from": "mcp", "to": "send", "line": "flow", "points": [[550, 250], [780, 250]], "label": "送信の依頼", "labelAt": [620, 250] },
    { "id": "w-done", "from": "mcp", "to": "table", "line": "write", "points": [[480, 282], [480, 390], [440, 390]], "label": "返信済みにする", "labelAt": [480, 330] },
    { "id": "w-chat", "from": "send", "to": "chat", "line": "flow", "points": [[920, 250], [976, 250]], "label": "記録", "labelAt": [948, 250], "tip": "返信の本文と宛先" },
    { "id": "w-loop", "from": "send", "to": "recv", "line": "loop", "points": [[850, 282], [850, 497], [270, 497], [270, 282]], "label": "次の問い合わせへ（受け取りへ戻る）", "labelAt": [560, 497] }
  ]
}`;

/** 使用方法『図を描く-見本』に記載していたシーケンス図の定義（モックの `inquiry-seq`）の JSON */
export const INQUIRY_SEQ_TEXT: string = `{
  "title": "問い合わせ 1 通の流れ",
  "scope": "受け取りから下書きの保存まで",
  "updated": "2026-10-17",
  "participants": [
    { "id": "mail", "kind": "external", "tag": "外部", "name": "メールサーバー" },
    { "id": "recv", "kind": "script", "name": "受け取り" },
    { "id": "classify", "kind": "dm", "tag": "{{意思決定モデル}}", "name": "分類" },
    { "id": "draft", "kind": "llm", "name": "返信の下書き" },
    { "id": "mcp", "kind": "mcp", "name": "窓口の MCP" }
  ],
  "steps": [
    { "from": "mail", "to": "recv", "label": "問い合わせのメール", "tip": "件名・本文・送信者のアドレス" },
    { "from": "recv", "to": "classify", "label": "本文" },
    { "from": "classify", "to": "recv", "label": "返信の種類", "reply": true },
    { "from": "recv", "to": "draft", "label": "本文と種類", "tip": "本文・返信の種類・回答の候補 3 件" },
    { "from": "draft", "to": "mcp", "label": "下書きを保存する" },
    { "from": "mcp", "to": "draft", "label": "保存した下書きの ID", "reply": true }
  ],
  "loop": { "label": "1 へ戻る（次の問い合わせ）" }
}`;

/** 使用方法『図を描く』に記載していた判定フローチャートの定義（モックの `judgement` に線の端を加えたもの）の JSON */
export const JUDGEMENT_TEXT: string = `{
  "title": "外観をどこで変えるかの判定",
  "scope": "描いた文書の外観を変えたいとき",
  "updated": "2026-11-02",
  "width": 760,
  "height": 600,
  "nodes": [
    { "id": "start", "kind": "start", "x": 310, "y": 16, "w": 100, "h": 100, "name": "外観を変える" },
    { "id": "q0", "kind": "question", "x": 220, "y": 156, "w": 280, "h": 136, "name": "全ての利用側の既定を変える外観か" },
    { "id": "q1", "kind": "question", "x": 220, "y": 340, "w": 280, "h": 136, "name": "テーマの CSS 変数で表せるか" },
    { "id": "a1", "kind": "action", "x": 560, "y": 188, "w": 180, "h": 72, "name": "既定の変更を Issue で頼む" },
    { "id": "r1", "kind": "result", "x": 250, "y": 524, "w": 220, "h": 60, "name": "CSS 変数を上書きする" },
    { "id": "r2", "kind": "result", "x": 560, "y": 378, "w": 180, "h": 60, "name": "層の外の CSS を追加する" }
  ],
  "wires": [
    { "id": "j-start", "from": "start", "to": "q0", "line": "flow", "points": [[360, 116], [360, 156]] },
    { "id": "j-q0-yes", "from": "q0", "to": "a1", "line": "flow", "points": [[500, 224], [560, 224]], "label": "YES", "labelAt": [530, 224] },
    { "id": "j-q0-no", "from": "q0", "to": "q1", "line": "flow", "points": [[360, 292], [360, 340]], "label": "NO", "labelAt": [360, 316] },
    { "id": "j-q1-yes", "from": "q1", "to": "r1", "line": "flow", "points": [[360, 476], [360, 524]], "label": "YES", "labelAt": [360, 500] },
    { "id": "j-q1-no", "from": "q1", "to": "r2", "line": "flow", "points": [[500, 408], [560, 408]], "label": "NO", "labelAt": [530, 408] }
  ]
}`;
