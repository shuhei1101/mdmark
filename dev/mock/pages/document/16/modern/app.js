// 描いた文書のモックの印刷: 印刷の前後の折り畳みの開閉と、モックだけの「印刷の見え方」の切り替え

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  const root = document.documentElement;
  const printStyles = document.querySelector("[data-print-styles]");
  const previewButton = document.querySelector("[data-preview-toggle]");
  const schemeButtons = document.querySelectorAll("[data-scheme-set]");

  // 印刷の前に閉じていた折り畳み
  let closedDetails = [];

  /** 閉じている折り畳みを全て開き、開いた分を覚える。 */
  const openAllDetails = () => {
    closedDetails = [...document.querySelectorAll(".mdmark details:not([open])")];
    for (const details of closedDetails) details.open = true;
  };

  /** 開いた折り畳みを閉じ直す。 */
  const restoreDetails = () => {
    for (const details of closedDetails) details.open = false;
    closedDetails = [];
  };

  // 印刷の前後（実装でも持つ処理）: 折り畳みの開閉だけを受け持つ
  window.addEventListener("beforeprint", () => {
    if (printStyles.media !== "all") openAllDetails();
  });
  window.addEventListener("afterprint", () => {
    if (printStyles.media !== "all") restoreDetails();
  });

  // モックだけの「印刷の見え方」: 印刷の規則を画面にも当て、紙と同じく明るい配色にする
  let schemeBeforePreview = "";

  /** 印刷の見え方に切り替える。 */
  const enterPreview = () => {
    openAllDetails();
    schemeBeforePreview = root.dataset.scheme;
    root.dataset.scheme = "light";
    printStyles.media = "all";
    previewButton.setAttribute("aria-pressed", "true");
  };

  /** 印刷の見え方を抜ける。配色は restoreScheme が真のときだけ戻す。 */
  const leavePreview = (restoreScheme) => {
    restoreDetails();
    if (restoreScheme) root.dataset.scheme = schemeBeforePreview;
    printStyles.media = "print";
    previewButton.setAttribute("aria-pressed", "false");
  };

  previewButton.addEventListener("click", () => (printStyles.media === "all" ? leavePreview(true) : enterPreview()));

  // 印刷の見え方の間に配色を変えたら、選んだ配色のまま印刷の見え方を抜ける
  for (const button of schemeButtons) {
    button.addEventListener("click", () => {
      if (printStyles.media === "all") leavePreview(false);
    });
  }
}
