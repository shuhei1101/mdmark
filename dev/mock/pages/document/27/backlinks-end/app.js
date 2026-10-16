// 拡張記法を描いた文書のモックの印刷: 印刷の前後の展開と、モックだけの「印刷の見え方」の切り替え

// sample.js・syntax.js と同じ大域に読むため、宣言をブロックに閉じる
{
  const root = document.documentElement;
  const printStyles = [...document.querySelectorAll("[data-print-styles]")];
  const previewButton = document.querySelector("[data-preview-toggle]");
  const schemeButtons = document.querySelectorAll("[data-scheme-set]");
  const { expand, restore } = window.mdmarkMockPrint;

  /** 印刷の見え方を画面に当てているかを返す。 */
  const previewing = () => printStyles[0].media === "all";

  // 印刷の前後（実装でも持つ処理）: タブの全ての中身と閉じた記法の展開だけを受け持つ
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
}
