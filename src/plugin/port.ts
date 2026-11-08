import { connect } from "node:net";
import { CliError } from "../cli/errors.ts";

/** 1 回の TCP の接続を待つ上限（ミリ秒） */
export const CONNECT_TIMEOUT_MS = 1000;

/** 待ち受けているかを確認するアドレス */
const PROBE_HOST = "127.0.0.1";

/** `127.0.0.1:{port}` へ TCP でつなぎ、接続を受ければ真、拒まれるか待ちの上限を超えれば偽を返却する */
export const isPortListening = (options: {
  port: number;
  timeoutMs: number;
}): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = connect({ host: PROBE_HOST, port: options.port });
    const finish = (listening: boolean) => {
      socket.destroy();
      resolve(listening);
    };
    socket.setTimeout(options.timeoutMs, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });

/** 待ち受けるポートを上書きする環境変数の名前。`plugin/.mcp.json` の `url` も同じ名前で展開する */
export const PORT_ENV = "MDMARK_PORT";

/** `PORT_ENV` が無いときに待ち受けるポート */
export const DEFAULT_PORT = 8782;

/** `PORT_ENV` が 1〜65535 の整数でないときの `CliError` の文。`{value}` を受け取った値に置き換える */
export const INVALID_PORT_MESSAGE =
  "MDMARK_PORT の値 {value} はポートに使用できません。1〜65535 の整数を設定してください。";

/** ポートに使用できる最小の値と最大の値 */
const MIN_PORT = 1;
const MAX_PORT = 65535;

/** 待ち受けるポートを決める。`PORT_ENV` が無いか空なら `DEFAULT_PORT`、1〜65535 の整数ならその数、それ以外は `CliError` を投げる */
export function readPort(options: { env: NodeJS.ProcessEnv }): number {
  const value = options.env[PORT_ENV];
  if (value === undefined || value === "") {
    return DEFAULT_PORT;
  }
  const port = Number(value);
  if (!/^\d+$/.test(value) || port < MIN_PORT || port > MAX_PORT) {
    throw new CliError(INVALID_PORT_MESSAGE.replace("{value}", value));
  }
  return port;
}
