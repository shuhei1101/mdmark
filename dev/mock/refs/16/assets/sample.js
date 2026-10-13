// デザインスタイルの見本の配色の切り替え（モック専用の操作列のボタン）

const root = document.documentElement;
const buttons = document.querySelectorAll("[data-scheme-set]");

/** 配色を当て、選んでいるボタンを押された状態にする。 */
const applyScheme = (scheme) => {
  root.dataset.scheme = scheme;
  for (const button of buttons) {
    button.setAttribute("aria-pressed", String(button.dataset.schemeSet === scheme));
  }
};

for (const button of buttons) {
  button.addEventListener("click", () => applyScheme(button.dataset.schemeSet));
}

// 開いた時点の配色は OS の設定に合わせる
applyScheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
