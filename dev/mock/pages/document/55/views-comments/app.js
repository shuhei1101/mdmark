// ビューとコメントを置いた文書のモック: 場面の切り替えと、モックだけの「印刷の見え方」。
// URL の ?view= でビューの場面（board・table・filtered・filtered-board・unknown-column・unknown-filter・no-table・off）を、
// ?comments= でコメントの場面（none・loaded・save-error・orphaned・off）を選ぶ。
// view.js・comment.js より先に読み、描く前に文書を場面に合わせる

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  const params = new URLSearchParams(location.search);
  // 場面の既定（URL に無いときの値）
  const DEFAULTS = { view: "board", comments: "none" };
  const scene = {
    view: params.get("view") ?? DEFAULTS.view,
    comments: params.get("comments") ?? DEFAULTS.comments,
  };

  // 場面の違う文書の部分: data-mock-scene="{軸}:{値} {値}…" のうち、今の場面に当たらないものを外す
  for (const part of document.querySelectorAll("[data-mock-scene]")) {
    const [axis, values] = part.dataset.mockScene.split(":");
    if (!values.split(" ").includes(scene[axis])) part.remove();
  }

  // ビュー: 表で開く・担当の列の絞り込みで佐藤を選んだ状態を、描く前のビューの属性で当てる
  const view = document.querySelector("[data-mock-view]");
  if (view && ["table", "filtered"].includes(scene.view)) view.dataset.default = "table";
  if (view && ["filtered", "filtered-board"].includes(scene.view)) view.dataset.filterValue = "佐藤";

  // コメント: 機能がオフのときは選んでもボタンを出さない。保存できない場面は保存で失敗させる
  const article = document.querySelector("article.mdmark");
  if (scene.comments === "off") delete article.dataset.mockComments;
  if (scene.comments === "save-error") article.dataset.mockComments = "save-error";

  /** 今の場面を保ったまま、1 つの軸だけを変えた URL を返す。 */
  const urlWith = (axis, value) => {
    const next = new URLSearchParams(params);
    if (value === DEFAULTS[axis]) next.delete(axis);
    else next.set(axis, value);
    const query = next.toString();
    return query ? `?${query}` : location.pathname.split("/").pop() || "index.html";
  };

  // 操作列のリンク: 今の場面を押された見た目にし、行き先に他の軸の場面を残す
  for (const link of document.querySelectorAll("[data-scene-axis]")) {
    link.href = urlWith(link.dataset.sceneAxis, link.dataset.sceneValue);
    if (scene[link.dataset.sceneAxis] === link.dataset.sceneValue) link.setAttribute("aria-current", "page");
  }

  // ---------- 印刷 ----------

  // 印刷の前後の展開（syntax.js の window.mdmarkMockPrint）は syntax.js を読んだ後に使う
  document.addEventListener("DOMContentLoaded", () => {
    const root = document.documentElement;
    const printStyles = [...document.querySelectorAll("[data-print-styles]")];
    const previewButton = document.querySelector("[data-preview-toggle]");
    const schemeButtons = document.querySelectorAll("[data-scheme-set]");
    const { expand, restore } = window.mdmarkMockPrint;

    /** 印刷の見え方を画面に当てているかを返す。 */
    const previewing = () => printStyles[0].media === "all";

    // 印刷の前後（実装でも持つ処理）: 閉じた記法の展開だけを受け持つ
    window.addEventListener("beforeprint", () => {
      if (!previewing()) expand();
    });
    window.addEventListener("afterprint", () => {
      if (!previewing()) restore();
    });

    // モックだけの「印刷の見え方」: 印刷の規則を画面にも当て、紙と同じく明るい配色にする
    let schemeBeforePreview = "";

    /** 印刷の規則の link の media を切り替える。 */
    const setPrintMedia = (media) => {
      for (const link of printStyles) link.media = media;
    };

    /** 印刷の見え方に切り替える。 */
    const enterPreview = () => {
      expand();
      schemeBeforePreview = root.dataset.scheme;
      root.dataset.scheme = "light";
      setPrintMedia("all");
      previewButton.setAttribute("aria-pressed", "true");
    };

    /** 印刷の見え方を抜ける。配色は restoreScheme が真のときだけ戻す。 */
    const leavePreview = (restoreScheme) => {
      restore();
      if (restoreScheme) root.dataset.scheme = schemeBeforePreview;
      setPrintMedia("print");
      previewButton.setAttribute("aria-pressed", "false");
    };

    previewButton.addEventListener("click", () => (previewing() ? leavePreview(true) : enterPreview()));

    // 印刷の見え方の間に配色を変えたら、選んだ配色のまま印刷の見え方を抜ける
    for (const button of schemeButtons) {
      button.addEventListener("click", () => {
        if (previewing()) leavePreview(false);
      });
    }
  });
}
