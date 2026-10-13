// 描いた文書のモックの印刷: 印刷の前に折り畳みを開いて明るい配色にし、終えたら元に戻す

const root = document.documentElement;
const previewButton = document.querySelector("[data-preview-toggle]");
const schemeButtons = document.querySelectorAll("[data-scheme-set]");

// 印刷の前の状態（開いていなかった折り畳みと配色）
let closedDetails = [];
let schemeBeforePrint = "";

/** 印刷の見え方に切り替える。 */
const enterPrint = () => {
  if (root.dataset.preview === "print") return;
  closedDetails = [...document.querySelectorAll(".mdmark details:not([open])")];
  for (const details of closedDetails) details.open = true;
  schemeBeforePrint = root.dataset.scheme;
  root.dataset.scheme = "light";
  root.dataset.preview = "print";
  previewButton.setAttribute("aria-pressed", "true");
};

/** 印刷の前の見え方に戻す。 */
const leavePrint = () => {
  if (root.dataset.preview !== "print") return;
  for (const details of closedDetails) details.open = false;
  closedDetails = [];
  root.dataset.scheme = schemeBeforePrint;
  delete root.dataset.preview;
  previewButton.setAttribute("aria-pressed", "false");
};

window.addEventListener("beforeprint", enterPrint);
window.addEventListener("afterprint", leavePrint);
previewButton.addEventListener("click", () => (root.dataset.preview === "print" ? leavePrint() : enterPrint()));

// 印刷の見え方の間に配色を変えたら、印刷の見え方を抜ける
for (const button of schemeButtons) {
  button.addEventListener("click", () => {
    if (root.dataset.preview !== "print") return;
    closedDetails.forEach((details) => (details.open = false));
    closedDetails = [];
    delete root.dataset.preview;
    previewButton.setAttribute("aria-pressed", "false");
  });
}
