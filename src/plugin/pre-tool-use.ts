/** Claude Code がフックに渡す、セッションの作業のフォルダの絶対パスの環境変数 */
export const PROJECT_DIR_ENV = "CLAUDE_PROJECT_DIR";

/** Claude Code がプラグイン mdmark の MCP サーバー mdmark のツール名の前に付ける頭 */
export const TOOL_NAME_PREFIX = "mcp__plugin_mdmark_mdmark__";

/** `project_dir` を入れるツールの名前。`plugin/hooks/hooks.json` の PreToolUse の `matcher` は、この名前に `TOOL_NAME_PREFIX` を付けて `|` でつないだもの */
export const PROJECT_DIR_TOOLS = ["check", "export_html", "build_site"];

/** 作業のフォルダを入れるツールの引数の名前 */
const PROJECT_DIR_ARG = "project_dir";

/** 標準入力の `tool_input` に作業のフォルダを `project_dir` で入れた `updatedInput` を標準出力に 1 行書く。環境変数が無いか空なら何も書かない */
export async function runPreToolUse(options: {
  /** 環境変数 */
  env: NodeJS.ProcessEnv;
  /** 標準入力の文字列 */
  input: string;
  /** 標準出力へ 1 行書く */
  stdout: (line: string) => void;
}): Promise<0> {
  const { env, input, stdout } = options;
  const projectDir = env[PROJECT_DIR_ENV];
  if (!projectDir) {
    return 0;
  }
  const { tool_input: toolInput } = JSON.parse(input) as {
    tool_input: Record<string, unknown>;
  };
  stdout(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        updatedInput: { ...toolInput, [PROJECT_DIR_ARG]: projectDir },
      },
    }),
  );
  return 0;
}

// 束ねた `plugin/scripts/pre-tool-use.js` を入口として実行されたときだけ、標準入力を読み切って流す
if (import.meta.main) {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  process.exitCode = await runPreToolUse({
    env: process.env,
    input: Buffer.concat(chunks).toString("utf8"),
    stdout: (line) => console.log(line),
  });
}
