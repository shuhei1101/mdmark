// #653 のモックの見本: ガントチャート・タイムライン・Git グラフ・ジャーニー・ブロック図の Mermaid と補足

/** section 3 つ・タスク 8 つ。done・active・crit・milestone・after・終了日・期間を持ち、別の 2 つの section が同じ名前（準備）を持つ */
export const GANTT = `gantt
  title リリースの計画
  dateFormat YYYY-MM-DD
  axisFormat %m/%d
  excludes weekends
  section 準備
    要件を決める :done, req, 2026-11-02, 3d
    設計する :active, des, after req, 4d
  section 開発
    実装する :crit, imp, after des, 5d
    結合テスト :tst, after imp, 3d
  section 準備
    環境を用意する :env, 2026-11-09, 2026-11-13
    手順書を書く :2026-11-16, 2d
  section 公開
    リリース判定 :milestone, rel, after tst, 0d
    告知する :after rel, 2d`;

/** 補足: ID を持つタスクは ID、ID を持たないタスクはタスク名で指す */
export const GANTT_DATA = {
  notes: {
    imp: { text: "map の 5 種類の読み取りと配置を実装する" },
    手順書を書く: { text: "利用側の更新の手順を含める" },
  },
};

/** 補足の layout: 色と閉じた状態は適用し、座標は書き方の警告にする */
export const GANTT_LAYOUT_DATA = {
  ...GANTT_DATA,
  layout: {
    rel: { color: "purple" },
    公開: { collapsed: true },
    tst: { pos: { x: 40, y: 40 } },
  },
};

/** section 2 つ・期間 5 つ・出来事 9 つ。1 つの期間は section の前に置く */
export const TIMELINE = `timeline
  title mdmark の歩み
  2026-04 : 構想を書く
  section 記法を作る
    2026-05 : 表のマーカー : 注意書き : タブ
    2026-06 : 図の部品
  section 図を広げる
    2026-08 : map を追加する : シーケンス図
    2026-10 : ER 図と状態遷移図
    2026-11 : マインドマップ`;

/** 補足: 期間は期間の文字、出来事は出来事の文字で指す */
export const TIMELINE_DATA = {
  notes: {
    "2026-08": { text: "Mermaid と補足で図を書けるようにした" },
    マインドマップ: { text: "木の配置を追加した" },
  },
};

/** ブランチ 3 つ・commit 9 つ・merge 2 つ・cherry-pick 1 つ。id・msg・tag・REVERSE・HIGHLIGHT と、id も msg も無い commit を持つ */
export const GIT_GRAPH = `gitGraph
  commit id: "init"
  commit msg: "README を書く"
  branch develop
  checkout develop
  commit id: "map" tag: "v0.10.0"
  branch feat
  checkout feat
  commit msg: "gantt を足す"
  commit type: HIGHLIGHT id: "axis"
  checkout develop
  commit
  merge feat
  checkout main
  commit type: REVERSE msg: "誤りを戻す"
  cherry-pick id: "map"
  merge develop`;

/** 補足: id を持つ commit は ID、msg だけの commit は msg、どちらも無い commit は記載順の番号、ブランチはブランチ名で指す */
export const GIT_GRAPH_DATA = {
  notes: {
    axis: { text: "軸に沿った配置を入れた commit" },
    "README を書く": { text: "最初の説明" },
    c6: { text: "develop の作業の続き" },
    feat: { text: "機能を足すブランチ" },
  },
};

/** section 3 つ・タスク 7 つ・人 3 人。点数は 1〜5 を全て含む */
export const JOURNEY = `journey
  title 文書を書いて読む
  section 書く
    記法を調べる: 2: 作成者
    図を書く: 4: 作成者, AI
  section 点検する
    mdmark check を流す: 3: 作成者, AI
    ずれを直す: 1: 作成者
  section 読む
    文書を開く: 5: 読者
    図を辿る: 4: 読者, 作成者, AI
    検索する: 3: 読者`;

export const JOURNEY_DATA = {
  notes: {
    ずれを直す: { text: "直し方が分からない警告が残る" },
  },
};

/** columns 3・ブロック 7 つ・入れ子のブロック 1 つ・space 1 つ・線 3 本。形状 4 種と幅 :2 を持つ */
export const BLOCK = `block-beta
  columns 3
  page["利用側のページ"]:2 cdn[("CDN")]
  mdmark(("mdmark"))
  space
  block:core
    columns 2
    parse["読み取り"] layout("配置")
  end
  doc["文書"] cache[("キャッシュ")]
  page --> mdmark
  mdmark -- "描く" --> core
  cdn --> page`;

export const BLOCK_DATA = {
  notes: {
    core: { text: "種類ごとの読み取りと配置" },
  },
};

/** 補足の layout: 色と入れ子のブロックの閉じた状態は適用し、座標は書き方の警告にする */
export const BLOCK_LAYOUT_DATA = {
  ...BLOCK_DATA,
  layout: {
    mdmark: { color: "green" },
    core: { collapsed: true },
    doc: { pos: { x: 0, y: 0 } },
  },
};

/** 読めない行を持つガントチャート（期間の書き方が誤っている） */
export const GANTT_UNREADABLE = `gantt
  dateFormat YYYY-MM-DD
  section 準備
    要件を決める :req, 2026-11-02, 3d
    設計する :des, after req, 四日`;
