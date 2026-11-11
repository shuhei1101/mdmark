// モックだけの「印刷の見え方」の切り替え: 印刷の規則の link を画面にも当て、紙と同じく明るい配色にする。
// 開閉は refs/27/assets/glossary.js、配色は refs/16/assets/sample.js が受け持ち、この後に読む

// sample.js・glossary.js と同じ大域に読むため、宣言をブロックに閉じる
{
  const previewButton = document.querySelector("[data-preview-toggle]");
  const printStyles = [...document.querySelectorAll("[data-print-styles]")];
  const root = document.documentElement;
  let schemeBeforePreview = "";

  /** 印刷の見え方を画面に当てているかを返す。 */
  const previewing = () => printStyles[0].media === "all";

  /** 印刷の規則の link の media を切り替え、ボタンの押下の状態を合わせる。 */
  const setPreview = (on) => {
    for (const link of printStyles) link.media = on ? "all" : "print";
    previewButton.setAttribute("aria-pressed", String(on));
  };

  // 押すと印刷の見え方にして明るい配色にする。押し直すと前の配色に戻す
  previewButton.addEventListener("click", () => {
    if (previewing()) {
      root.dataset.scheme = schemeBeforePreview;
      setPreview(false);
      return;
    }
    // 開いているツールチップを閉じる（紙には出さない）
    window.dispatchEvent(new Event("beforeprint"));
    schemeBeforePreview = root.dataset.scheme;
    root.dataset.scheme = "light";
    setPreview(true);
  });

  // 印刷の見え方の間に配色を変えたら、選んだ配色のまま印刷の見え方を抜ける
  for (const button of document.querySelectorAll("[data-scheme-set]")) {
    button.addEventListener("click", () => {
      if (previewing()) setPreview(false);
    });
  }
}
