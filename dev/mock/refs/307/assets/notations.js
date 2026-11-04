// #307 のモックの操作: CSV の表の RAW の切り替えと、wide の範囲の幅の切り替え
document.addEventListener("click", (event) => {
  // RAW のボタン（案 A・C・D）: 押すたびに元の CSV と表を切り替える
  const button = event.target.closest(".mdmark-raw-toggle");
  if (button) {
    const box = button.closest(".mdmark-table");
    const pressed = button.getAttribute("aria-pressed") === "true";
    button.setAttribute("aria-pressed", String(!pressed));
    if (pressed) box.removeAttribute("data-view"); else box.dataset.view = "raw";
    return;
  }
  // 「表 | RAW」（案 B）: 押した側の見せ方にする
  const item = event.target.closest(".mdmark-raw-seg-item");
  if (item) {
    const box = item.closest(".mdmark-table");
    const raw = item.dataset.viewSet === "raw";
    for (const other of item.parentElement.children) other.setAttribute("aria-pressed", String(other === item));
    if (raw) box.dataset.view = "raw"; else box.removeAttribute("data-view");
    return;
  }
  // wide の切り替えのボタン: 押すたびに本文の幅と広げた幅を切り替える
  const toggle = event.target.closest(".mdmark-wide-toggle");
  if (toggle) {
    const range = toggle.closest(".mdmark-wide");
    const wide = range.dataset.state !== "wide";
    range.dataset.state = wide ? "wide" : "narrow";
    toggle.setAttribute("aria-pressed", String(wide));
    const label = wide ? "本文の幅で表示" : "広げて表示";
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
  }
});
