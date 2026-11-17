// #649 のモックの見本: マインドマップの Mermaid と補足

/** 根 1 つ・1 レイヤー目の枝 4 つ・項目 14 個。形状 6 種と形状の指定の無い項目、ID を持つ項目、30 文字の名前、同じ文字（課題）の枝 2 つ、::icon と ::: を持つ */
export const MINDMAP = `mindmap
  root((企画の論点))
    a1[目的]
      利用者を増やす
      継続して使ってもらう
    (体制)
      課題
        人手が足りない
      ))担当の割り当て((
    )予算(
      課題
        見積もりが粗い
    {{スケジュール}}
      リリースの時期を四半期の終わりまでに決めて関係者へ共有する
        ::icon(fa fa-book)
      マイルストーン
      :::urgent`;

/** 補足: ID を持つ項目は ID、ID を持たない項目は表示する文字で指す */
export const MINDMAP_DATA = {
  notes: {
    a1: { text: "利用者の数と、続けて使う割合の 2 つで測る" },
    人手が足りない: { text: "開発 2 名・デザイン 0 名" },
  },
};

/** 補足の layout: 色と閉じた状態は適用し、座標と並び順は書き方の警告にする */
export const MINDMAP_LAYOUT_DATA = {
  ...MINDMAP_DATA,
  layout: {
    a1: { color: "purple" },
    予算: { collapsed: true },
    マイルストーン: { pos: { x: 40, y: 40 } },
    継続して使ってもらう: { order: 0 },
  },
};

/** 補足の案内: 手順 1 は 1 レイヤー目の枝 2 つ、手順 2 は枝の中へ入って項目 1 つを強調する */
export const MINDMAP_WALK_DATA = {
  ...MINDMAP_DATA,
  walkthroughs: [
    { title: "目的と体制", text: "まず、何のためにやるかと、誰がやるかを決める", highlight: ["a1", "体制"] },
    { title: "体制の課題", text: "体制の中では、人手の不足がいちばん大きい課題", enter: "体制", highlight: ["人手が足りない"] },
  ],
};

/** 読めない行（根より浅い行）を持つマインドマップ */
export const MINDMAP_UNREADABLE = `mindmap
  root((企画の論点))
    a1[目的]
      利用者を増やす
    (体制)
 二つ目の根`;
