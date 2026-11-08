import { CliError } from "../cli/errors.ts";
import { CONNECT_TIMEOUT_MS, isPortListening, readPort } from "./port.ts";

/** 常駐サーバーが待ち受けていないときに `additionalContext` に指定する 1 行。`{port}` をポートに置き換える */
export const NOT_LISTENING_CONTEXT =
  "mdmark の MCP の常駐サーバーが 127.0.0.1:{port} で待ち受けていないため、mdmark の MCP のツールは使用できない。/mdmark:global-setup で起動できる。";

/** `MDMARK_PORT` が使用できない値のときの 1 行。`{value}` を受け取った値に置き換える */
export const PORT_INVALID_CONTEXT =
  "MDMARK_PORT の値 {value} はポートとして使用できないため、mdmark の MCP のツールは使用できない。1〜65535 の整数を設定する。";

/** `additionalContext` を JSON の 1 行で標準出力に書き込む */
const writeContext = (
  stdout: (line: string) => void,
  context: string,
): void => {
  stdout(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: context,
      },
    }),
  );
};

/** ポートが待ち受けていなければ、そのことと `/mdmark:global-setup` で起動できることを 1 行で標準出力に書き込む。どの場合も 0 を返却する */
export const runSessionStart = async (options: {
  env: NodeJS.ProcessEnv;
  stdout: (line: string) => void;
}): Promise<0> => {
  let port: number;
  try {
    port = readPort({ env: options.env });
  } catch (error) {
    if (error instanceof CliError) {
      writeContext(
        options.stdout,
        PORT_INVALID_CONTEXT.replace("{value}", options.env.MDMARK_PORT ?? ""),
      );
      return 0;
    }
    throw error;
  }
  if (await isPortListening({ port, timeoutMs: CONNECT_TIMEOUT_MS })) {
    return 0;
  }
  writeContext(
    options.stdout,
    NOT_LISTENING_CONTEXT.replace("{port}", String(port)),
  );
  return 0;
};

// まとめた `plugin/scripts/session-start.js` を入口として実行されたときだけ実行する
if (import.meta.main) {
  process.exitCode = await runSessionStart({
    env: process.env,
    stdout: (line) => console.log(line),
  });
}
