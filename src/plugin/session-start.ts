import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CliError } from "../cli/errors.ts";
import { CONNECT_TIMEOUT_MS, isPortListening, readPort } from "./port.ts";
import { loadPrompt, PromptError, renderPrompt } from "./prompt.ts";

/** 常駐サーバーが待ち受けていないときの文のプロンプト（変数 `port`） */
export const PROMPT_NOT_LISTENING = "hooks/session-start-not-listening";

/** `MDMARK_PORT` が使用できない値のときの文のプロンプト（変数 `value`） */
export const PROMPT_PORT_INVALID = "hooks/session-start-port-invalid";

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

/** プロンプトを描いた文を `additionalContext` に書き込む。プロンプトファイルを読み込めない・描けないときは何も書き込まない */
const writePrompt = async (options: {
  root: string;
  id: string;
  vars: Record<string, unknown>;
  stdout: (line: string) => void;
}): Promise<void> => {
  let context: string;
  try {
    const prompt = await loadPrompt({ root: options.root, id: options.id });
    context = renderPrompt(prompt, options.vars);
  } catch (error) {
    if (error instanceof PromptError) return;
    throw error;
  }
  writeContext(options.stdout, context);
};

/** ポートが待ち受けていなければ、そのことと `/mdmark:global-setup` で起動できることを 1 行で標準出力に書き込む。どの場合も 0 を返却する */
export const runSessionStart = async (options: {
  env: NodeJS.ProcessEnv;
  stdout: (line: string) => void;
  /** プラグインのルート */
  root: string;
}): Promise<0> => {
  const { root, stdout } = options;
  let port: number;
  try {
    port = readPort({ env: options.env });
  } catch (error) {
    if (error instanceof CliError) {
      await writePrompt({
        root,
        id: PROMPT_PORT_INVALID,
        vars: { value: options.env.MDMARK_PORT ?? "" },
        stdout,
      });
      return 0;
    }
    throw error;
  }
  if (await isPortListening({ port, timeoutMs: CONNECT_TIMEOUT_MS })) {
    return 0;
  }
  await writePrompt({ root, id: PROMPT_NOT_LISTENING, vars: { port }, stdout });
  return 0;
};

// まとめた `plugin/scripts/session-start.js` を入口として実行されたときだけ実行する
if (import.meta.main) {
  process.exitCode = await runSessionStart({
    env: process.env,
    stdout: (line) => console.log(line),
    root: dirname(dirname(fileURLToPath(import.meta.url))),
  });
}
