/** 各処理に依存として渡すログの出力先。`LogOutputChannel` のうち使うメソッドだけを持つ */
export type Logger = {
  /** 経過 */
  info: (message: string, ...args: unknown[]) => void;
  /** 代わりの値で続けた失敗 */
  warn: (message: string, ...args: unknown[]) => void;
  /** 利用者の操作が果たせなかった失敗 */
  error: (error: string | Error, ...args: unknown[]) => void;
};
