import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/Table" } satisfies Meta<Record<string, unknown>>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const Data: Story = {
  name: "Data",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["記法","機能名","増分（KB）"]',
    rows: '[["表の操作","table","6.2"],["注意書き","callout","1.4"],["タブ","tabs","2.1"]]',
  },
};

export const SortedAscending: Story = {
  name: "SortedAscending",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["記法","機能名","増分（KB）"]',
    rows: '[["表の操作","table","6.2"],["注意書き","callout","1.4"],["タブ","tabs","2.1"]]',
    sort: '{"column":2,"direction":"ascending"}',
  },
};

export const SortedDescending: Story = {
  name: "SortedDescending",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["記法","機能名","増分（KB）"]',
    rows: '[["表の操作","table","6.2"],["注意書き","callout","1.4"],["タブ","tabs","2.1"]]',
    sort: '{"column":2,"direction":"descending"}',
  },
};

export const FilterSelectOpen: Story = {
  name: "FilterSelectOpen",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["名前","説明","更新日"]',
    rows: '[["りんご","描画を速くする","2026-10-01"],["みかん","印刷を修正する","2026-10-10"],["りんご飴","描画の崩れを修正する","2026-10-20"]]',
    filters:
      '[{"column":0,"kind":"select"},{"column":1,"kind":"text"},{"column":2,"kind":"date"}]',
    openFilter: 0,
  },
};

export const FilterTextOpen: Story = {
  name: "FilterTextOpen",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["名前","説明","更新日"]',
    rows: '[["りんご","描画を速くする","2026-10-01"],["みかん","印刷を修正する","2026-10-10"],["りんご飴","描画の崩れを修正する","2026-10-20"]]',
    filters:
      '[{"column":0,"kind":"select"},{"column":1,"kind":"text"},{"column":2,"kind":"date"}]',
    openFilter: 1,
    filterValues: '[{"column":1,"text":"描画"}]',
  },
};

export const FilterDateOpen: Story = {
  name: "FilterDateOpen",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["名前","説明","更新日"]',
    rows: '[["りんご","描画を速くする","2026-10-01"],["みかん","印刷を修正する","2026-10-10"],["りんご飴","描画の崩れを修正する","2026-10-20"]]',
    filters:
      '[{"column":0,"kind":"select"},{"column":1,"kind":"text"},{"column":2,"kind":"date"}]',
    openFilter: 2,
  },
};

export const Filtered: Story = {
  name: "Filtered",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["名前","説明","更新日"]',
    rows: '[["りんご","描画を速くする","2026-10-01"],["みかん","印刷を修正する","2026-10-10"],["りんご飴","描画の崩れを修正する","2026-10-20"]]',
    filters: '[{"column":0,"kind":"select"}]',
    filterValues: '[{"column":0,"values":["りんご"]}]',
  },
};

export const NoMatch: Story = {
  name: "NoMatch",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["名前","説明"]',
    rows: '[["りんご","描画を速くする"],["みかん","印刷を修正する"]]',
    filters: '[{"column":1,"kind":"text"}]',
    filterValues: '[{"column":1,"text":"存在しない"}]',
  },
};

export const DefaultOverflow: Story = {
  name: "DefaultOverflow",
  parameters: { server: { id: "table" } },
  args: {
    features: '["pin"]',
    columns:
      '["文書","行数","表","図","Chrome","Edge","Firefox","Safari","iOS Safari","Android Chrome"]',
    rows: '[["導入の手順","128","8","0","18","17","23","16","15","16"]]',
    overflow: true,
    pinned: "[0]",
  },
};

export const Pinned: Story = {
  name: "Pinned",
  parameters: { server: { id: "table" } },
  args: {
    features: '["pin"]',
    columns:
      '["文書","行数","表","図","Chrome","Edge","Firefox","Safari","iOS Safari","Android Chrome"]',
    rows: '[["導入の手順","128","8","0","18","17","23","16","15","16"]]',
    overflow: true,
    pinned: "[0,1]",
    pinMode: "through",
  },
};

export const PinnedEach: Story = {
  name: "PinnedEach",
  parameters: { server: { id: "table" } },
  args: {
    features: '["pin"]',
    columns:
      '["文書","行数","表","図","Chrome","Edge","Firefox","Safari","iOS Safari","Android Chrome"]',
    rows: '[["導入の手順","128","8","0","18","17","23","16","15","16"]]',
    overflow: true,
    pinned: "[0,2]",
    pinMode: "each",
  },
};

export const NoPin: Story = {
  name: "NoPin",
  parameters: { server: { id: "table" } },
  args: {
    features: "[]",
    columns:
      '["文書","行数","表","図","Chrome","Edge","Firefox","Safari","iOS Safari","Android Chrome"]',
    rows: '[["導入の手順","128","8","0","18","17","23","16","15","16"]]',
    overflow: true,
  },
};

export const PinAndWide: Story = {
  name: "PinAndWide",
  parameters: { server: { id: "table" } },
  args: {
    features: '["pin"]',
    columns: '["ID","担当","概要","状態","期限"]',
    rows: '[["#245","表","はみ出す表で先頭の列を既定でピン止めし、pin= と wide= と check= を使用できるようにする","未着手","2026-11-21"],["#249","コード","tree を除く全てのコードブロックでインデントによる畳む・開くと縦線を付ける","未着手","2026-11-28"]]',
    overflow: true,
    pin: "[1]",
    pinned: "[1]",
    wide: "[2]",
  },
};

export const Check: Story = {
  name: "Check",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["キー","型","必須","既定"]',
    rows: '[["version","string","true","-"],["features","object","false","全てオン"],["libraries","object","false","jsDelivr"],["build","array","true","-"]]',
    check: "[2]",
  },
};

export const DefaultFits: Story = {
  name: "DefaultFits",
  parameters: { server: { id: "table" } },
  args: {
    features: '["pin"]',
    columns: '["用語","意味"]',
    rows: '[["マーカー","HTML コメントで記載する目印"]]',
  },
};

export const Plain: Story = {
  name: "Plain",
  parameters: { server: { id: "table" } },
  args: {
    kind: "plain",
    features: "[]",
    columns: '["用語","意味"]',
    rows: '[["マーカー","HTML コメントで記載する目印"],["記載の警告","読み込めない指定を通知する枠"]]',
  },
};

export const Closed: Story = {
  name: "Closed",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["バージョン","日付","変更"]',
    rows: '[["v0.1.0","2026-10-10","文書を描く土台を入れた"]]',
    collapse: "closed",
  },
};

export const ClosedTitle: Story = {
  name: "ClosedTitle",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["バージョン","日付","変更"]',
    rows: '[["v0.1.0","2026-10-10","文書を描く土台を入れた"],["v0.2.0","2026-10-20","表の機能を追加した"]]',
    collapse: "closed",
    title: "リリースの一覧",
  },
};

export const OpenTitle: Story = {
  name: "OpenTitle",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["バージョン","日付","変更"]',
    rows: '[["v0.1.0","2026-10-10","文書を描く土台を入れた"],["v0.2.0","2026-10-20","表の機能を追加した"]]',
    collapse: "open",
    title: "リリースの一覧",
  },
};

export const LongCells: Story = {
  name: "LongCells",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["とても長い列の名前で見出しの幅を超えるもの","値"]',
    rows: '[["とても長い値でセルの幅を超えて折り返すときの見え方を確認するために、長文の列の最小の幅より長い文を入れた値","1"]]',
    filters: '[{"column":0,"kind":"select"}]',
    long: "[0]",
    autoWidths: '[{"column":0,"width":630},{"column":1,"width":80}]',
  },
};

export const Count: Story = {
  name: "Count",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","count"]',
    columns: '["名前","説明","更新日"]',
    rows: '[["りんご","描画を速くする","2026-10-01"],["みかん","印刷を修正する","2026-10-10"],["りんご飴","描画の崩れを修正する","2026-10-20"]]',
    filters: '[{"column":1,"kind":"text"}]',
  },
};

export const CountFiltered: Story = {
  name: "CountFiltered",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","count"]',
    columns: '["名前","説明","更新日"]',
    rows: '[["りんご","描画を速くする","2026-10-01"],["みかん","印刷を修正する","2026-10-10"],["りんご飴","描画の崩れを修正する","2026-10-20"]]',
    filters: '[{"column":1,"kind":"text"}]',
    filterValues: '[{"column":1,"text":"描画"}]',
  },
};

export const ColumnsHidden: Story = {
  name: "ColumnsHidden",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","columns"]',
    columns: '["名前","説明","更新日"]',
    rows: '[["りんご","描画を速くする","2026-10-01"],["みかん","印刷を修正する","2026-10-10"],["りんご飴","描画の崩れを修正する","2026-10-20"]]',
    hide: "[1]",
  },
};

export const ColumnsMenuOpen: Story = {
  name: "ColumnsMenuOpen",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","columns"]',
    columns: '["名前","説明","更新日"]',
    rows: '[["りんご","描画を速くする","2026-10-01"],["みかん","印刷を修正する","2026-10-10"],["りんご飴","描画の崩れを修正する","2026-10-20"]]',
    hide: "[1]",
    hiddenColumns: "[2]",
    openColumns: true,
  },
};

export const Totals: Story = {
  name: "Totals",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","total"]',
    columns: '["名前","数量","単価"]',
    rows: '[["りんご","10","100"],["みかん","2","200"],["りんご飴","33","300"],["ぶどう","","400"]]',
    filters: '[{"column":0,"kind":"text"}]',
    totals:
      '[{"column":0,"calc":"count"},{"column":1,"calc":"sum"},{"column":2,"calc":"avg"}]',
  },
};

export const TotalsFiltered: Story = {
  name: "TotalsFiltered",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","total"]',
    columns: '["名前","数量","単価"]',
    rows: '[["りんご","10","100"],["みかん","2","200"],["りんご飴","33","300"],["ぶどう","","400"]]',
    filters: '[{"column":0,"kind":"text"}]',
    filterValues: '[{"column":0,"text":"りんご"}]',
    totals:
      '[{"column":0,"calc":"count"},{"column":1,"calc":"sum"},{"column":2,"calc":"avg"}]',
  },
};

export const TotalsEmpty: Story = {
  name: "TotalsEmpty",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","count","total"]',
    columns: '["名前","数量","単価"]',
    rows: '[["りんご","10","100"],["みかん","2","200"],["りんご飴","33","300"],["ぶどう","","400"]]',
    filters: '[{"column":0,"kind":"text"}]',
    filterValues: '[{"column":0,"text":"存在しない"}]',
    totals:
      '[{"column":0,"calc":"count"},{"column":1,"calc":"sum"},{"column":2,"calc":"avg"}]',
  },
};

export const Copied: Story = {
  name: "Copied",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","copy"]',
    columns: '["名前","説明","更新日"]',
    rows: '[["りんご","描画を速くする","2026-10-01"],["みかん","印刷を修正する","2026-10-10"]]',
    copyState: "copied",
  },
};

export const CopyFailed: Story = {
  name: "CopyFailed",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","copy"]',
    columns: '["名前","説明","更新日"]',
    rows: '[["りんご","描画を速くする","2026-10-01"],["みかん","印刷を修正する","2026-10-10"]]',
    copyState: "failed",
  },
};

export const RowLinkTarget: Story = {
  name: "RowLinkTarget",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","rowlink"]',
    columns: '["名前","説明","更新日"]',
    rows: '[["りんご","描画を速くする","2026-10-01"],["みかん","印刷を修正する","2026-10-10"],["りんご飴","描画の崩れを修正する","2026-10-20"]]',
    rowIds: '["りんご","みかん","りんご飴"]',
    targetRow: 1,
  },
};

export const AllFeatures: Story = {
  name: "AllFeatures",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features:
      '["sort","pin","filter","count","columns","total","copy","rowlink"]',
    columns: '["名前","説明","数量"]',
    rows: '[["なつめ","描画を速くする","12"],["かりん","印刷を修正する","8"],["ざくろ","描画の崩れを修正する","5"]]',
    hide: "[1]",
    totals: '[{"column":2,"calc":"sum"}]',
    rowIds: '["なつめ","かりん","ざくろ"]',
  },
};

export const TotalsUnreadable: Story = {
  name: "TotalsUnreadable",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","total"]',
    columns: '["名前","数量","単価"]',
    rows: '[["りんご","10","100"],["みかん","約 3","200"],["りんご飴","33","300"],["ぶどう","-","400"]]',
    filters: '[{"column":0,"kind":"text"}]',
    totals: '[{"column":1,"calc":"sum"},{"column":2,"calc":"avg"}]',
  },
};

export const TotalsMenuOpen: Story = {
  name: "TotalsMenuOpen",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","total"]',
    columns: '["名前","数量","単価"]',
    rows: '[["りんご","10","100"],["みかん","2","200"],["りんご飴","33","300"],["ぶどう","","400"]]',
    totals:
      '[{"column":0,"calc":"count"},{"column":1,"calc":"sum"},{"column":2,"calc":"avg"}]',
    openTotals: "true",
  },
};

export const TotalsHidden: Story = {
  name: "TotalsHidden",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","total"]',
    columns: '["名前","数量","単価"]',
    rows: '[["りんご","10","100"],["みかん","2","200"],["りんご飴","33","300"],["ぶどう","","400"]]',
    totals:
      '[{"column":0,"calc":"count"},{"column":1,"calc":"sum"},{"column":2,"calc":"avg"}]',
    shownTotals: '["sum"]',
  },
};

export const CopyMenuOpen: Story = {
  name: "CopyMenuOpen",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","copy"]',
    columns: '["名前","説明","更新日"]',
    rows: '[["りんご","描画を速くする","2026-10-01"],["みかん","印刷を修正する","2026-10-10"]]',
    openCopy: "true",
  },
};

export const CopyFallback: Story = {
  name: "CopyFallback",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","copy"]',
    columns: '["名前","説明","更新日"]',
    rows: '[["りんご","描画を速くする","2026-10-01"],["みかん","印刷を修正する","2026-10-10"]]',
    copyState: "failed",
    copyFallback:
      '{"format":"markdown","text":"| 名前 | 説明 | 更新日 |\\n| --- | --- | --- |\\n| りんご | 描画を速くする | 2026-10-01 |\\n| みかん | 印刷を修正する | 2026-10-10 |"}',
  },
};

export const RowLinkCopied: Story = {
  name: "RowLinkCopied",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","rowlink"]',
    columns: '["名前","説明","更新日"]',
    rows: '[["りんご","描画を速くする","2026-10-01"],["みかん","印刷を修正する","2026-10-10"],["りんご飴","描画の崩れを修正する","2026-10-20"]]',
    rowIds: '["りんご","みかん","りんご飴"]',
    targetRow: "1",
    rowLinkNotice: "copied",
  },
};

export const RowLinkFailed: Story = {
  name: "RowLinkFailed",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","rowlink"]',
    columns: '["名前","説明","更新日"]',
    rows: '[["りんご","描画を速くする","2026-10-01"],["みかん","印刷を修正する","2026-10-10"],["りんご飴","描画の崩れを修正する","2026-10-20"]]',
    rowIds: '["りんご","みかん","りんご飴"]',
    targetRow: "1",
    rowLinkNotice: "failed",
  },
};

export const StickyRows: Story = {
  name: "StickyRows",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","total"]',
    columns: '["番号","数量"]',
    rows: '[["1","1"],["2","2"],["3","3"],["4","4"],["5","5"],["6","6"],["7","7"],["8","8"],["9","9"],["10","10"],["11","11"],["12","12"],["13","13"],["14","14"],["15","15"],["16","16"],["17","17"],["18","18"],["19","19"],["20","20"],["21","21"],["22","22"],["23","23"],["24","24"],["25","25"],["26","26"],["27","27"],["28","28"],["29","29"],["30","30"]]',
    totals: '[{"column":1,"calc":"sum"}]',
  },
};

export const Highlighted: Story = {
  name: "Highlighted",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["案件","状態","金額（円）"]',
    rows: '[["見積もりの作成","完了","120000"],["契約書の確認","保留","80000"],["請求書の発行","進行中","45000"],["納品の確認","完了","30000"]]',
    highlight: '[{"column":2,"color":"blue"}]',
  },
};

export const RowColors: Story = {
  name: "RowColors",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["案件","状態","金額（円）"]',
    rows: '[["見積もりの作成","完了","120000"],["契約書の確認","保留","80000"],["請求書の発行","進行中","45000"],["納品の確認","完了","30000"]]',
    rowColors: '["green","yellow",null,"green"]',
  },
};

export const RowColorsSorted: Story = {
  name: "RowColorsSorted",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["案件","状態","金額（円）"]',
    rows: '[["見積もりの作成","完了","120000"],["契約書の確認","保留","80000"],["請求書の発行","進行中","45000"],["納品の確認","完了","30000"]]',
    rowColors: '["green","yellow",null,"green"]',
    sort: '{"column":2,"direction":"ascending"}',
  },
};

export const HighlightAndRowColors: Story = {
  name: "HighlightAndRowColors",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["案件","状態","金額（円）"]',
    rows: '[["見積もりの作成","完了","120000"],["契約書の確認","保留","80000"],["請求書の発行","進行中","45000"],["納品の確認","完了","30000"]]',
    highlight: '[{"column":2,"color":"blue"}]',
    rowColors: '[null,"red",null,null]',
  },
};

export const RowColorsDark: Story = {
  name: "RowColorsDark",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["案件","状態","金額（円）"]',
    rows: '[["見積もりの作成","完了","120000"],["契約書の確認","保留","80000"],["請求書の発行","進行中","45000"],["納品の確認","完了","30000"]]',
    highlight: '[{"column":2,"color":"blue"}]',
    rowColors: '["green","yellow",null,"green"]',
    scheme: "dark",
  },
};

export const Merged: Story = {
  name: "Merged",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["地域","支店","売上（万円）","件数","売上（万円）","件数"]',
    rows: '[["東日本","札幌","120","14","135","16"],["東日本","仙台","98","11","102","12"],["東日本","東京","310","40","342","45"],["西日本","大阪","260","31","248","29"],["西日本","福岡","140","17","151","19"]]',
    headRows:
      '[[{"html":"地域","column":0,"rowspan":2},{"html":"支店","column":1,"rowspan":2},{"html":"上期","column":2,"colspan":2},{"html":"下期","column":4,"colspan":2}],[{"html":"売上（万円）","column":2},{"html":"件数","column":3},{"html":"売上（万円）","column":4},{"html":"件数","column":5}]]',
    rowHeader: 1,
    mergeColumns: "[0]",
  },
};

export const MergedSorted: Story = {
  name: "MergedSorted",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["地域","支店","売上（万円）","件数","売上（万円）","件数"]',
    rows: '[["東日本","札幌","120","14","135","16"],["東日本","仙台","98","11","102","12"],["東日本","東京","310","40","342","45"],["西日本","大阪","260","31","248","29"],["西日本","福岡","140","17","151","19"]]',
    headRows:
      '[[{"html":"地域","column":0,"rowspan":2},{"html":"支店","column":1,"rowspan":2},{"html":"上期","column":2,"colspan":2},{"html":"下期","column":4,"colspan":2}],[{"html":"売上（万円）","column":2},{"html":"件数","column":3},{"html":"売上（万円）","column":4},{"html":"件数","column":5}]]',
    rowHeader: 1,
    mergeColumns: "[0]",
    sort: '{"column":4,"direction":"descending"}',
  },
};

export const MergedFiltered: Story = {
  name: "MergedFiltered",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["地域","支店","売上（万円）","件数","売上（万円）","件数"]',
    rows: '[["東日本","札幌","120","14","135","16"],["東日本","仙台","98","11","102","12"],["東日本","東京","310","40","342","45"],["西日本","大阪","260","31","248","29"],["西日本","福岡","140","17","151","19"]]',
    headRows:
      '[[{"html":"地域","column":0,"rowspan":2},{"html":"支店","column":1,"rowspan":2},{"html":"上期","column":2,"colspan":2},{"html":"下期","column":4,"colspan":2}],[{"html":"売上（万円）","column":2},{"html":"件数","column":3},{"html":"売上（万円）","column":4},{"html":"件数","column":5}]]',
    rowHeader: 1,
    mergeColumns: "[0]",
    filters: '[{"column":0,"kind":"select"}]',
    filterValues: '[{"column":0,"values":["東日本"]}]',
  },
};

export const RowHeaderPinned: Story = {
  name: "RowHeaderPinned",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns:
      '["分類","記法","Chrome","Edge","Firefox","Safari","iOS Safari","Android Chrome","VS Code","書き出した HTML"]',
    rows: '[["表","セルの結合","124","124","128","17.4","17.4","124","1.95","対応"],["表","多段の見出し","124","124","128","17.4","17.4","124","1.95","対応"],["表","行見出し","124","124","128","17.4","17.4","124","1.95","対応"],["コード","折りたたみ","124","124","128","17.4","17.4","124","1.95","対応"],["コード","インデントの縦線","124","124","128","17.4","17.4","124","1.95","対応"]]',
    rowHeader: 2,
    mergeColumns: "[0]",
    overflow: true,
    pinned: "[0,1]",
  },
};

export const MergeInvalid: Story = {
  name: "MergeInvalid",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["地域","支店","売上（万円）"]',
    rows: '[["^^","札幌","120"],["<<","仙台","98"],["東日本","東京","310"]]',
  },
};

export const SettingsOpenReorder: Story = {
  name: "SettingsOpenReorder",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","columns","reorder"]',
    columns: '["名前","型","既定","説明"]',
    rows: '[["features.table","bool","true","表の機能のオン・オフ"],["features.html","bool","true","埋め込んだ HTML のオン・オフ"],["build.include","string[]","","まとめる Markdown の glob"]]',
    openColumns: true,
  },
};

export const SettingsReorderOnly: Story = {
  name: "SettingsReorderOnly",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","reorder"]',
    columns: '["名前","型","既定","説明"]',
    rows: '[["features.table","bool","true","表の機能のオン・オフ"]]',
    openColumns: true,
  },
};

export const ReorderDragging: Story = {
  name: "ReorderDragging",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","columns","reorder"]',
    columns: '["名前","型","既定","説明"]',
    rows: '[["features.table","bool","true","表の機能のオン・オフ"]]',
    openColumns: true,
    dragging: '{"column":3,"target":0,"side":"before"}',
  },
};

export const Reordered: Story = {
  name: "Reordered",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","columns","reorder"]',
    columns: '["名前","型","既定","説明"]',
    rows: '[["features.table","bool","true","表の機能のオン・オフ"],["build.include","string[]","","まとめる Markdown の glob"]]',
    order: "[3,0,2,1]",
    hiddenColumns: "[3]",
  },
};

export const ReorderGroups: Story = {
  name: "ReorderGroups",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","columns","reorder"]',
    columns: '["名前","型","既定","必須","備考"]',
    headRows:
      '[[{"html":"名前","column":0,"rowspan":2},{"html":"設定","column":1,"colspan":3},{"html":"備考","column":4,"rowspan":2}],[{"html":"型","column":1},{"html":"既定","column":2},{"html":"必須","column":3}]]',
    rows: '[["features.table","bool","true","✓",""]]',
    pin: "[0]",
    overflow: true,
    pinned: "[0]",
    pinMode: "through",
    openColumns: true,
  },
};

export const PinnedUnderMergedHeader: Story = {
  name: "PinnedUnderMergedHeader",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["名前","型","既定","必須","備考"]',
    headRows:
      '[[{"html":"名前","column":0,"rowspan":2},{"html":"設定","column":1,"colspan":3},{"html":"備考","column":4,"rowspan":2}],[{"html":"型","column":1},{"html":"既定","column":2},{"html":"必須","column":3}]]',
    rows: '[["table.pin","string","each","false","each は押した列だけを留め、through は押した列までを留める。既定は each で、mount は他の値を無視して each にする"]]',
    wide: "[4]",
    overflow: true,
    pinned: "[0,2]",
    pinMode: "each",
  },
};

export const Tree: Story = {
  name: "Tree",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["pin","filter"]',
    columns: '["キー","型","必須","既定","説明"]',
    rows: '[["features.table","bool","✓","true","表の機能のオン・オフ"],["features.html","bool","","","埋め込んだ HTML のオン・オフ"],["aliases[].id","string","","","行の ID"],["aliases[].metadata.alias_type.type","ref | custom","","","値の取り方"]]',
    tree: 0,
    treeType: 1,
    treeRequired: 2,
    treeDefault: 3,
  },
};

export const TreeFolded: Story = {
  name: "TreeFolded",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: "[]",
    columns: '["キー","型","必須","既定","説明"]',
    rows: '[["features.table","bool","✓","true","表の機能のオン・オフ"],["features.html","bool","","","埋め込んだ HTML のオン・オフ"],["aliases[].id","string","","","行の ID"],["aliases[].metadata.alias_type.type","ref | custom","","","値の取り方"]]',
    tree: 0,
    treeType: 1,
    treeRequired: 2,
    treeDefault: 3,
    collapsedPaths: '["aliases[]"]',
  },
};

export const TreeFiltered: Story = {
  name: "TreeFiltered",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["pin","filter","count"]',
    columns: '["キー","型","必須","既定","説明"]',
    rows: '[["features.table","bool","✓","true","表の機能のオン・オフ"],["features.html","bool","","","埋め込んだ HTML のオン・オフ"],["aliases[].id","string","","","行の ID"],["aliases[].metadata.alias_type.type","ref | custom","","","値の取り方"]]',
    tree: 0,
    treeType: 1,
    treeRequired: 2,
    treeDefault: 3,
    filters: '[{"column":0,"kind":"text"}]',
    treeFilter: "id",
  },
};

export const TreeSelected: Story = {
  name: "TreeSelected",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: "[]",
    columns: '["キー","型","必須","既定","説明"]',
    rows: '[["features.table","bool","✓","true","表の機能のオン・オフ"],["features.html","bool","","","埋め込んだ HTML のオン・オフ"],["aliases[].id","string","","","行の ID"],["aliases[].metadata.alias_type.type","ref | custom","","","値の取り方"]]',
    tree: 0,
    treeType: 1,
    treeRequired: 2,
    treeDefault: 3,
    selectedPath: "features.html",
  },
};

export const TreeExample: Story = {
  name: "TreeExample",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: "[]",
    columns: '["キー","型","必須","既定","説明"]',
    rows: '[["features.table","bool","✓","true","表の機能のオン・オフ"],["features.html","bool","","","埋め込んだ HTML のオン・オフ"],["aliases[].id","string","","","行の ID"],["aliases[].metadata.alias_type.type","ref | custom","","","値の取り方"]]',
    tree: 0,
    treeType: 1,
    treeRequired: 2,
    treeDefault: 3,
    selectedPath: "aliases[].metadata.alias_type.type",
    example:
      '{"heading":"設定の見本","tabs":[{"name":"最小","lines":[{"text":"features:","path":"features"},{"text":"  table: true","path":"features.table"}]},{"name":"エイリアス","lines":[{"text":"aliases:","path":"aliases[]"},{"text":"  - id: terms","path":"aliases[].id"},{"text":"    metadata:","path":"aliases[].metadata"},{"text":"      alias_type:","path":"aliases[].metadata.alias_type"},{"text":"        type: custom","path":"aliases[].metadata.alias_type.type"}]}],"active":1,"hidden":false}',
  },
};

export const TreeExampleMissing: Story = {
  name: "TreeExampleMissing",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: "[]",
    columns: '["キー","型","必須","既定","説明"]',
    rows: '[["features.table","bool","✓","true","表の機能のオン・オフ"],["features.html","bool","","","埋め込んだ HTML のオン・オフ"],["aliases[].id","string","","","行の ID"],["aliases[].metadata.alias_type.type","ref | custom","","","値の取り方"]]',
    tree: 0,
    treeType: 1,
    treeRequired: 2,
    treeDefault: 3,
    selectedPath: "aliases[].metadata.alias_type.type",
    example:
      '{"heading":"設定の見本","tabs":[{"name":"最小","lines":[{"text":"features:","path":"features"},{"text":"  table: true","path":"features.table"}]},{"name":"エイリアス","lines":[{"text":"aliases:","path":"aliases[]"},{"text":"  - id: terms","path":"aliases[].id"},{"text":"    metadata:","path":"aliases[].metadata"},{"text":"      alias_type:","path":"aliases[].metadata.alias_type"},{"text":"        type: custom","path":"aliases[].metadata.alias_type.type"}]}],"active":0,"hidden":false}',
  },
};

export const TreeExampleHidden: Story = {
  name: "TreeExampleHidden",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: "[]",
    columns: '["キー","型","必須","既定","説明"]',
    rows: '[["features.table","bool","✓","true","表の機能のオン・オフ"],["features.html","bool","","","埋め込んだ HTML のオン・オフ"],["aliases[].id","string","","","行の ID"],["aliases[].metadata.alias_type.type","ref | custom","","","値の取り方"]]',
    tree: 0,
    treeType: 1,
    treeRequired: 2,
    treeDefault: 3,
    example:
      '{"heading":"設定の見本","tabs":[{"name":"最小","lines":[{"text":"features:","path":"features"},{"text":"  table: true","path":"features.table"}]},{"name":"エイリアス","lines":[{"text":"aliases:","path":"aliases[]"},{"text":"  - id: terms","path":"aliases[].id"},{"text":"    metadata:","path":"aliases[].metadata"},{"text":"      alias_type:","path":"aliases[].metadata.alias_type"},{"text":"        type: custom","path":"aliases[].metadata.alias_type.type"}]}],"active":0,"hidden":true}',
  },
};

export const CsvTable: Story = {
  name: "CsvTable",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["名前","拠点","金額"]',
    rows: '[["北山","東京, 本社","1200"],["南田","大阪","800"]]',
    rawCsv: '名前,拠点,金額\n北山,"東京, 本社",1200\n南田,大阪,800',
  },
};

export const CsvRaw: Story = {
  name: "CsvRaw",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter"]',
    columns: '["名前","拠点","金額"]',
    rows: '[["北山","東京, 本社","1200"],["南田","大阪","800"]]',
    rawCsv: '名前,拠点,金額\n北山,"東京, 本社",1200\n南田,大阪,800',
    rawShown: true,
  },
};

export const ColumnsButtonA: Story = {
  name: "ColumnsButtonA",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["count","columns","copy"]',
    columns: '["名前","説明","更新日"]',
    rows: '[["りんご","描画を速くする","2026-10-01"],["みかん","印刷を修正する","2026-10-10"],["りんご飴","描画の崩れを修正する","2026-10-20"]]',
    hide: "[1]",
  },
};

export const FitsContent: Story = {
  name: "FitsContent",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","resize"]',
    columns: '["名前","数量"]',
    rows: '[["りんご","3"],["みかん","5"],["ぶどう","2"]]',
    autoWidths: '[{"column":0,"width":80},{"column":1,"width":72}]',
  },
};

export const AutoWidth: Story = {
  name: "AutoWidth",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","resize"]',
    columns: '["No","状態","更新日","名前","手順","説明"]',
    rows: '[["1","<span class=\\"mdmark-badge\\">対応中</span>","2026-11-01","表の幅","測る<br>分ける<br>描く","描画を速くするために、見出しの列ごとの幅を描いた後に一度だけ測り、表の見える幅が変わったときだけ列の幅を決め直す。並べ替え・絞り込み・列の表示の切り替えでは列の幅を変えず、読者がつまみで変えた列の幅は自動の幅より優先する"]]',
    long: "[5]",
    autoWidths:
      '[{"column":0,"width":60},{"column":1,"width":90},{"column":2,"width":112},{"column":3,"width":78},{"column":4,"width":92},{"column":5,"width":713}]',
  },
};

export const TwoLongColumns: Story = {
  name: "TwoLongColumns",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","resize"]',
    columns: '["名前","説明","備考"]',
    rows: '[["表の幅","描画を速くするために、見出しの列ごとの幅を描いた後に一度だけ測り、表の見える幅が変わったときだけ列の幅を決め直す。並べ替え・絞り込み・列の表示の切り替えでは列の幅を変えず、読者がつまみで変えた列の幅は自動の幅より優先する","長文の列が 2 つある表の備考の列の文字"]]',
    long: "[1,2]",
    autoWidths:
      '[{"column":0,"width":82},{"column":1,"width":740},{"column":2,"width":323}]',
  },
};

export const NarrowScroll: Story = {
  name: "NarrowScroll",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","resize"]',
    columns: '["名前","説明","備考"]',
    rows: '[["表の幅","描画を速くするために、見出しの列ごとの幅を描いた後に一度だけ測り、表の見える幅が変わったときだけ列の幅を決め直す。並べ替え・絞り込み・列の表示の切り替えでは列の幅を変えず、読者がつまみで変えた列の幅は自動の幅より優先する","描画を速くするために、見出しの列ごとの幅を描いた後に一度だけ測り、表の見える幅が変わったときだけ列の幅を決め直す。並べ替え・絞り込み・列の表示の切り替えでは列の幅を変えず、読者がつまみで変えた列の幅は自動の幅より優先する"]]',
    long: "[1,2]",
    overflow: "true",
    autoWidths:
      '[{"column":0,"width":82},{"column":1,"width":630},{"column":2,"width":630}]',
  },
};

export const WidthRange: Story = {
  name: "WidthRange",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","resize"]',
    columns: '["名前","説明","備考"]',
    rows: '[["表の幅","描画を速くするために、見出しの列ごとの幅を描いた後に一度だけ測り、表の見える幅が変わったときだけ列の幅を決め直す。並べ替え・絞り込み・列の表示の切り替えでは列の幅を変えず、読者がつまみで変えた列の幅は自動の幅より優先する","補足"]]',
    long: "[1]",
    widthRanges: '[{"column":1,"min":20,"max":30}]',
    autoWidths:
      '[{"column":0,"width":82},{"column":1,"width":420},{"column":2,"width":72}]',
  },
};

export const LongColumnTextFilter: Story = {
  name: "LongColumnTextFilter",
  parameters: { server: { id: "table" } },
  args: {
    kind: "data",
    features: '["sort","pin","filter","resize"]',
    columns: '["名前","説明"]',
    rows: '[["表の幅","描画を速くするために、見出しの列ごとの幅を描いた後に一度だけ測り、表の見える幅が変わったときだけ列の幅を決め直す。並べ替え・絞り込み・列の表示の切り替えでは列の幅を変えず、読者がつまみで変えた列の幅は自動の幅より優先する"]]',
    long: "[1]",
    filters: '[{"column":0,"kind":"select"},{"column":1,"kind":"text"}]',
    openFilter: "1",
    autoWidths: '[{"column":0,"width":82},{"column":1,"width":1063}]',
  },
};

/** 列の幅のつまみのストーリーの共通の引数 */
const resizeArgs = {
  kind: "data",
  features: '["sort","pin","filter","resize"]',
  columns: '["名前","説明","更新日"]',
  rows: '[["りんご","描画を速くするために、見出しの列ごとの幅を描いた後に一度だけ測る","2026-10-01"],["みかん","印刷を修正する","2026-10-10"]]',
};

export const Resizable: Story = {
  name: "Resizable",
  parameters: { server: { id: "table" } },
  args: resizeArgs,
};

export const ResizeDragging: Story = {
  name: "ResizeDragging",
  parameters: { server: { id: "table" } },
  args: { ...resizeArgs, resizing: 0 },
};

export const ColumnResized: Story = {
  name: "ColumnResized",
  parameters: { server: { id: "table" } },
  args: { ...resizeArgs, widths: '[{"column":0,"width":200}]' },
};

export const WideResized: Story = {
  name: "WideResized",
  parameters: { server: { id: "table" } },
  args: { ...resizeArgs, wide: "[1]", widths: '[{"column":1,"width":110}]' },
};
