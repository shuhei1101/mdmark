/** コピーしたことの通知を出しておく時間（ミリ秒）。できなかったことの通知は次に押すまで残す */
export declare const COPIED_NOTICE_MS = 2000;
/** クリップボードへ文字を書き込み、書き込めたかを返却する。クリップボードが無いときと拒まれたときは `false` を返却し、例外を投げない */
export declare function copyText(text: string): Promise<boolean>;
