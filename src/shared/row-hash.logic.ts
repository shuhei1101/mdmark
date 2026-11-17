/** `location.hash` の最後の `#` の後ろを戻した文字を返却する。戻せないときはそのまま、`#` が無ければ空文字 */
export function rowIdFromHash(hash: string): string {
  const position = hash.lastIndexOf("#");
  if (position < 0) {
    return "";
  }
  const raw = hash.slice(position + 1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
