// 型は、使う版の dist/ の index.d.ts を ../mdmark/ に置いて読む
import type { MdmarkExtension, MdmarkMarkArgs } from "../mdmark/index.js";

/** `<!-- greet: 名前 -->` の場所に挨拶を描く拡張 */
const extension: MdmarkExtension = {
  name: "greet",
  directive: "greet",
  load: async () => ({
    draw(slot: HTMLElement, value: MdmarkMarkArgs): void {
      slot.textContent = `こんにちは、${value.args[0] ?? ""}`;
    },
  }),
};

export default extension;
