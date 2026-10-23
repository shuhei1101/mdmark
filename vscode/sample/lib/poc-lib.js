// PoC: 印の場所に描いた印（属性）を付ける自作の図のモジュール
export function draw(slot, args) {
  slot.setAttribute("data-poc-drawn", args.join(","));
  slot.textContent = `drawn:${args.join(",")}`;
}
