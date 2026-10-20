// 差分のモックの見本: 文書のリビジョン（新しい順）と、場面ごとの取り出し元（DiffSource の代わり）

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  /** 行の配列を 1 つの Markdown にする。 */
  const md = (...lines) => lines.join("\n");

  // 表の範囲: r1 から r2 でメールの件数を 120 から 150 に変える
  const table = (mail) => [
    "<!-- html -->",
    "<table>",
    "  <thead><tr><th>窓口</th><th>件数</th></tr></thead>",
    "  <tbody>",
    `    <tr><td>メール</td><td>${mail}</td></tr>`,
    "    <tr><td>電話</td><td>95</td></tr>",
    "  </tbody>",
    "</table>",
    "<!-- /html -->",
  ];

  // 返信の流れの範囲: r3 で足す
  const flow = [
    "<!-- html -->",
    '<div style="display: flex; flex-wrap: wrap; gap: 12px;">',
    '  <div style="flex: 1 1 10rem; padding: 12px 16px; border: 1px solid var(--mdmark-color-border); border-radius: 8px;"><strong>自動返信</strong><br>よくある質問から返す</div>',
    '  <div style="flex: 1 1 10rem; padding: 12px 16px; border: 1px solid var(--mdmark-color-border); border-radius: 8px;"><strong>担当者</strong><br>答えの無い問い合わせに返す</div>',
    "</div>",
    "<!-- /html -->",
  ];

  const r1 = {
    id: "r1",
    at: "2026-10-18T00:12:00Z",
    label: "初版",
    author: "佐藤",
    body: md(
      "# 問い合わせ窓口の週の報告",
      "",
      "10 月の第 2 週に受けた問い合わせを、窓口ごとにまとめます。",
      "",
      "集計は月曜の朝に更新します。",
      "",
      "## 窓口ごとの件数",
      "",
      ...table(120),
      "",
      "## 返し方",
      "",
      "自動返信は、よくある質問の表から答えを選びます。",
      "よくある質問の差分は、担当者が週に 1 回確かめます。",
      "答えの無い問い合わせは、翌日までに担当者へ回します。",
    ),
  };

  const r2 = {
    id: "r2",
    at: "2026-10-19T07:40:00Z",
    label: "件数を直し、返し方を書き足す",
    author: "鈴木",
    body: md(
      "# 問い合わせ窓口の週の報告",
      "",
      "10 月の第 2 週に受けた問い合わせを、窓口ごとにまとめます。",
      "",
      "## 窓口ごとの件数",
      "",
      ...table(150),
      "",
      "## 返し方",
      "",
      "自動返信は、よくある質問の表から答えを選びます。",
      "よくある質問の変更は、担当者が週に 1 回確かめます。",
      "答えの無い問い合わせは、翌日までに担当者へ回します。",
      "電話の問い合わせは、受けたその日のうちに返します。",
    ),
  };

  const r3 = {
    id: "r3",
    at: "2026-10-20T02:05:00Z",
    label: "見出しを書き換え、返信の流れを足す",
    author: "佐藤",
    body: md(
      "# 問い合わせ窓口の週の報告",
      "",
      "10 月の第 2 週に受けた問い合わせを、窓口ごとにまとめます。",
      "",
      "## 窓口ごとの件数",
      "",
      ...table(150),
      "",
      "## 返信の仕方",
      "",
      ...flow,
      "",
      "自動返信は、よくある質問の表から答えを選びます。",
      "よくある質問の変更は、担当者が週に 1 回確かめます。",
      "答えの無い問い合わせは、翌日までに担当者へ回します。",
      "電話の問い合わせは、受けたその日のうちに返します。",
    ),
  };

  // 本文が同じ 2 つのリビジョン（label だけが違う）
  const same = { ...r1, id: "r1-retitle", at: "2026-10-18T05:30:00Z", label: "題の表記を確かめる", author: "鈴木" };

  // label・author を持たないリビジョンと、長い label のリビジョン
  const sparse = [
    { ...r2, label: undefined, author: undefined },
    { ...r1, label: "初版。問い合わせ窓口の週の報告を、メール・フォーム・チャット・電話の 4 つの窓口ごとに分けてまとめる最初の版", author: "問い合わせ窓口の運用チームの佐藤" },
  ];

  // 長い行: 折り返して列の中に収める
  const long = [
    { ...r2, body: md("返信の下書きは https://example.com/inquiry/workspace/drafts/2026/10/second-week/answers-from-frequently-asked-questions-table に置き、担当者が送る前に確かめます。") },
    { ...r1, body: md("返信の下書きは https://example.com/inquiry/workspace/drafts/2026/10/second-week/answers-from-faq-table に置き、送る前に確かめます。") },
  ];

  // スクリプトとイベントの属性を書いた範囲: 描いた結果では落とす
  const script = [
    { ...r2, body: md(...table(150).slice(0, -1), '<button type="button" onclick="document.title = \'書き換えた\'">件数を数え直す</button>', "<script>document.title = '書き換えた';</script>", "<!-- /html -->") },
    { ...r1, body: md(...table(120).slice(0, -1), '<button type="button" onclick="document.title = \'書き換えた\'">件数を数え直す</button>', "<script>document.title = '書き換えた';</script>", "<!-- /html -->") },
  ];

  // 範囲の外だけを変えた 2 つのリビジョン
  const outside = [
    { ...r2, body: md("よくある質問の変更は、担当者が確かめます。", "", ...table(120)) },
    { ...r1, body: md("よくある質問の差分は、担当者が確かめます。", "", ...table(120)) },
  ];

  // 場面ごとの取り出し元の設定: revisions は新しい順
  window.mockDiffCases = {
    normal: { revisions: [r3, r2, r1] },
    single: { revisions: [r1] },
    same: { revisions: [same, r1] },
    "revisions-error": { revisions: [r3, r2, r1], failRevisions: true },
    "content-error": { revisions: [r3, r2, r1], failContent: ["r1"] },
    "no-segmenter": { revisions: [r3, r2, r1], segmenter: false },
    pending: { revisions: [r3, r2, r1], pending: true },
    sparse: { revisions: sparse },
    long: { revisions: long },
    script: { revisions: script },
    outside: { revisions: outside },
  };

  /** 場面の設定から、メモリーの見本を返す取り出し元（DiffSource）を作る。 */
  window.mockDiffSource = (config) => ({
    revisions: () => {
      if (config.pending) return new Promise(() => {});
      if (config.failRevisions) return Promise.reject(new Error("revisions"));
      return Promise.resolve(config.revisions.map(({ body, ...revision }) => revision));
    },
    content: (docId, revisionId) => {
      if (config.failContent?.includes(revisionId)) return Promise.reject(new Error("content"));
      return Promise.resolve(config.revisions.find((revision) => revision.id === revisionId).body);
    },
  });
}
