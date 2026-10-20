// @ts-check
// 型は、使う版の dist/ の index.d.ts を ../mdmark/ に置いて読む

/** `<!-- greet: 名前 -->` の場所に挨拶を描く拡張 */
/** @type {import("../mdmark/index.js").MdmarkExtension} */
export default {
  name: "greet",
  directive: "greet",
  load: async () => ({
    draw(slot, value) {
      slot.textContent = `こんにちは、${value.args[0] ?? ""}`;
    },
  }),
};
