/** `<!-- greet: 名前 -->` の場所に挨拶を描く拡張 */
export default {
  name: "greet",
  directive: "greet",
  load: async () => ({
    draw(slot, value) {
      slot.textContent = `こんにちは、${value.args[0] ?? ""}`;
    },
  }),
};
