// #307 のモックの操作: CSV の表の RAW の切り替えと、wide の範囲の幅の切り替え
document.addEventListener("click", (event) => {
  // RAW のボタン: 押すたびに元の CSV と表を切り替える
  const button = event.target.closest(".mdmark-raw-toggle");
  if (button) {
    const box = button.closest(".mdmark-table");
    const pressed = button.getAttribute("aria-pressed") === "true";
    button.setAttribute("aria-pressed", String(!pressed));
    if (pressed) box.removeAttribute("data-view"); else box.dataset.view = "raw";
    return;
  }
  // wide の切り替えのボタン: 押すたびに本文の幅と広げた幅を切り替える
  const toggle = event.target.closest(".mdmark-wide-toggle");
  if (toggle) {
    const range = toggle.closest(".mdmark-wide-bar").nextElementSibling;
    const wide = range.dataset.state !== "wide";
    range.dataset.state = wide ? "wide" : "narrow";
    toggle.setAttribute("aria-pressed", String(wide));
  }
});
