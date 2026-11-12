// 図の枠を指で動かすモックの操作（#508）: 図の余白をタップすると操作中にし、図の外をタップすると解く
// [data-mock-touch-active] の figure は、描いた直後から操作中にして見せる（モックだけの指定）
const activate = (box, on) => {
  if (on) box.setAttribute("data-touch-active", "");
  else box.removeAttribute("data-touch-active");
};
document.addEventListener("pointerup", (event) => {
  if (event.pointerType !== "touch") return;
  const inside = event.target.closest(".mdmark-diagram-box");
  for (const box of document.querySelectorAll(".mdmark-diagram-box[data-touch-active]")) if (box !== inside) activate(box, false);
  // ノード・線・ボタンの上のタップは、それぞれの操作にする
  if (inside && !event.target.closest(".mdmark-diagram-node, .mdmark-diagram-wire, button, a")) activate(inside, true);
});
addEventListener("load", () => {
  for (const figure of document.querySelectorAll("[data-mock-touch-active]")) {
    const box = figure.querySelector(".mdmark-diagram-box");
    if (box) activate(box, true);
  }
});
