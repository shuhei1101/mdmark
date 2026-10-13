/** `&`・`<`・`>`・`"`・`'` を文字参照にし、要素の中身にも属性の値にも置ける文字列にする */
export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
