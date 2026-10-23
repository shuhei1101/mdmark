/** コマンドが使う今のフォルダと、標準出力・標準エラーへの書き出し */
export type CliIo = {
  /** 今のフォルダ */
  cwd: string;
  /** 標準出力へ 1 行書く */
  stdout: (line: string) => void;
  /** 標準エラーへ 1 行書く */
  stderr: (line: string) => void;
};

/** 原因と直し方の 1 文を持ち、`main` が標準エラーに出して終了コード 1 にする誤り */
export class CliError extends Error {}
