// 余白のマーカーを見る場面: 配布物の mount でコメントの機能をオンにして文書を描き、余白のマーカーのモックを付ける。
// URL の ?place=・?same=・?closed=・?mode= で未確定の案と右側の目次の出し方を選ぶ

import { mount } from "../../../../../dist/index.js";
import { attachMarginMarkers } from "./margin.js";

/** 案の軸ごとの既定（URL に無いときの値。未確定の論点は推奨の案） */
const DEFAULTS = { place: "between", same: "merge", closed: "opener", mode: "hover" };

const params = new URLSearchParams(location.search);
const scene = Object.fromEntries(
  Object.entries(DEFAULTS).map(([axis, value]) => [axis, params.get(axis) ?? value]),
);

/** 今の案を保ったまま、1 つの軸だけを変えた URL を返す */
function urlWith(axis, value) {
  const next = new URLSearchParams(params);
  if (value === DEFAULTS[axis]) next.delete(axis);
  else next.set(axis, value);
  const query = next.toString();
  return query ? `?${query}` : "index.html";
}

// 操作列のリンク: 行き先に他の軸の案を残し、今の案を押された見た目にする
for (const link of document.querySelectorAll("[data-scene-axis]")) {
  const { sceneAxis, sceneValue } = link.dataset;
  link.href = urlWith(sceneAxis, sceneValue);
  if (scene[sceneAxis] === sceneValue) link.setAttribute("aria-current", "page");
}

/** 描く文書: 開いたセクション・閉じたセクション・タブ・行の詳細の中にコメントの箇所を持つ */
const markdown = `# 問い合わせ窓口の見直し

10 月の第 2 週の問い合わせを、窓口ごとに数えた。
来月から窓口の受け持ちを組み替えるため、件数と返信までの時間を並べて、どこに人を寄せるかを決める。

## 窓口ごとの件数

メールとフォームは自動返信で大半を返せている。
電話は担当者が返す割合が高く、返信の目安を超えやすい。
チャットは日中に集中し、夕方以降の問い合わせはほとんど無い。

| 窓口 | 件数 | 担当者が返した割合 |
| --- | --- | --- |
| メール | 162 | 23% |
| 電話 | 107 | 89% |
| チャット | 120 | 53% |

<!-- row-detail: 2 -->

電話の 107 件のうち、行の詳細の箇所にある 12 件は折り返しの電話で返した。

<!-- /row-detail -->

## 返信までの時間

返信までの時間は、受け付けてから最初の返信を送るまでを数える。
休日に受け付けた問い合わせは、次の営業日の始業から数える。
チャットの自動返信は数に入れず、担当者が最初に書いた返信の時刻を使う。

窓口ごとの中央値は、メールが 3 時間、フォームが 4 時間、チャットが 6 分、電話が 1 営業日だった。
電話の 1 営業日は、折り返しの電話をかける担当者が午後にしか空かないことによる。
午前に受けた電話を午前のうちに返せれば、中央値は半日ほどに縮まる見込み。

## 受け持ちの組み替え

<!-- tabs: group=plan -->

### 案 1

チャットの担当者を午後だけ電話へ回す。
チャットは夕方の件数が少ないため、午後の受け持ちを減らしても返信までの時間はほとんど変わらない。

### 案 2

電話の折り返しを、メールの担当者と分け合う。
タブの箇所に書いた分け方で、午前の折り返しをメールの担当者が受け持つ。

<!-- /tabs -->

## 補足

<!-- section: closed -->

去年の同じ週の数字は、閉じた箇所に残しておく。
去年は電話が 140 件で、今年より 3 割ほど多かった。

## 決めること

来週の定例で、案 1 と案 2 のどちらで始めるかを決める。
決めたら、窓口の案内のページと自動返信の文面を書き換える。
`;

/** 読み込むコメント: 同じ行の 2 か所・行の詳細・タブ・閉じたセクション・本文に無い文字 */
const stored = [
  { id: "c1", quote: "担当者", prefix: "電話は", suffix: "が返す割合", body: "担当者は 3 人で回しています。" },
  { id: "c2", quote: "返信の目安", prefix: "", suffix: "を超えやすい", body: "目安は 1 営業日で揃えたい。" },
  { id: "c3", quote: "行の詳細の箇所", prefix: "うち、", suffix: "にある", body: "折り返しの件数は先週より増えています。" },
  { id: "c4", quote: "午前のうちに返せれば", prefix: "", suffix: "", body: "午前の空きは誰が持ちますか。" },
  { id: "c5", quote: "タブの箇所", prefix: "", suffix: "に書いた", body: "分け方の表はまだ無いので、次の定例までに作ります。" },
  { id: "c6", quote: "閉じた箇所", prefix: "数字は、", suffix: "に残して", body: "去年の数字の出どころを書き足してください。" },
  { id: "c7", quote: "無い文字", prefix: "", suffix: "", body: "箇所が見つからないコメント（余白のマーカーを出さない）。" },
  { id: "c8", quote: "自動返信の文面", prefix: "", suffix: "", body: "文面の案は別の文書にまとめます。" },
];

/** コメントの読み書き: 保存先を持たず、保存したことにして ID を付けて返す */
const commentStore = {
  load: async () => stored.map((comment) => ({ ...comment })),
  save: async ({ comment }) => ({ ...comment, id: `c${Date.now()}` }),
};

const root = document.querySelector("#doc");
root.dataset.place = scene.place;
mount(root, {
  markdown,
  docId: "inquiry-review",
  commentStore,
  config: { features: { comments: true }, "side-toc": { mode: scene.mode } },
});
attachMarginMarkers(root, { same: scene.same, closed: scene.closed });
