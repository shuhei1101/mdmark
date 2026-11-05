// 範囲の ts・js の既定のエクスポートの関数に当たる動きのモック: 範囲の根の要素を押すと class is-open を付け外しする
document.addEventListener("DOMContentLoaded", () => {
  for (const root of document.querySelectorAll("[data-mock-range-script]")) {
    root.addEventListener("click", () => root.classList.toggle("is-open"));
  }
});
