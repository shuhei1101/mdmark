import type { Mark } from "./render.ts";
import { render, SLOT_ATTRIBUTE } from "./render.ts";

export { render };

/** 印の名前から、外部ライブラリのモジュールの URL を引く対応表 */
export type Libraries = Record<string, string>;

/** 外部ライブラリのモジュールが持つ、描く文字列を返す関数 */
type LibraryModule = { draw: () => string };

/** 外部ライブラリを読めなかった場所に出す知らせの枠を作る */
function createNotice(name: string): HTMLElement {
  const notice = document.createElement("div");
  notice.className = "mdmark-notice";
  notice.setAttribute("role", "note");
  notice.textContent = `外部ライブラリを読めませんでした: ${name}`;
  return notice;
}

/** 要素の中に文書を描き、印のある外部ライブラリだけを対応表の URL から読む */
export async function mount(
  el: HTMLElement,
  options: { markdown: string; libraries: Libraries },
): Promise<Mark[]> {
  const { html, marks } = render({
    markdown: options.markdown,
    libraryMarks: Object.keys(options.libraries),
  });
  el.innerHTML = html;
  for (const slot of el.querySelectorAll(`[${SLOT_ATTRIBUTE}]`)) {
    const name = slot.getAttribute(SLOT_ATTRIBUTE) ?? "";
    try {
      const module: LibraryModule = await import(options.libraries[name] ?? "");
      slot.textContent = module.draw();
    } catch {
      // 読めない場所だけを知らせの枠にし、ほかの本文は描いたままにする
      slot.replaceChildren(createNotice(name));
    }
  }
  return marks;
}
