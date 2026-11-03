// #307 のモックの操作: CSV の表の RAW のボタンで、元の CSV と描いた表を切り替える
document.addEventListener("click", (event) => {
  const button = event.target.closest(".mdmark-raw-toggle");
  if (!button) return;
  const box = button.closest(".mdmark-table");
  const pressed = button.getAttribute("aria-pressed") === "true";
  button.setAttribute("aria-pressed", String(!pressed));
  box.querySelector("table").hidden = !pressed;
  box.querySelector(".mdmark-raw").hidden = pressed;
});
