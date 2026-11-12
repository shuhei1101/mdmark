// @ts-check
// 型は、使用するバージョンの dist/ の index.d.ts を ../mdmark/ に配置して読み込む

/** `<!-- greet: {"target": "名前"} -->` の場所に挨拶を描く拡張 */
/** @type {import("../mdmark/index.js").MdmarkExtension} */
export default {
  name: "greet",
  directive: "greet",
  load: async () => ({
    draw(slot, value) {
      slot.textContent = `こんにちは、${String(value.options.target ?? "")}`;
    },
  }),
};
