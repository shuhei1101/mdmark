/** コピーしたことの知らせを出しておく時間（ミリ秒）。できなかったことの知らせは次に押すまで残す */
export const COPIED_NOTICE_MS = 2000;

/** クリップボードへ文字を書き、書けたかを返す。クリップボードが無いときと拒まれたときは `false` を返し、例外を投げない */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
