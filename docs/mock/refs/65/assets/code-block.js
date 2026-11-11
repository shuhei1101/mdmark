// モックだけの「印刷の見え方」: 印刷の規則を画面にも当て、紙と同じく明るい配色にする

// sample.js と同じ大域に読むため、宣言をブロックに閉じる
{
  const previewButton = document.querySelector("[data-preview-toggle]");
  const printStyles = [...document.querySelectorAll("[data-print-styles]")];
  const root = document.documentElement;
  let schemeBeforePreview = "";

  /** 印刷の見え方を画面に当てているかを返す。 */
  const previewing = () => printStyles[0].media === "all";

  // 押すと印刷の規則を画面に当て、押し直すと配色ごと戻す
  previewButton.addEventListener("click", () => {
    const next = !previewing();
    if (next) {
      schemeBeforePreview = root.dataset.scheme;
      root.dataset.scheme = "light";
    } else {
      root.dataset.scheme = schemeBeforePreview;
    }
    for (const link of printStyles) link.media = next ? "all" : "print";
    previewButton.setAttribute("aria-pressed", String(next));
  });
}
