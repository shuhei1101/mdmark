import { join, resolve } from "node:path";
import { CliError } from "../cli/errors.ts";
import { formatGuideContext, readGuideIndex } from "./guide.ts";

/** 同梱した索引と本文を置く、プラグインの直下のフォルダ名 */
const GUIDE_DIR = "guide";

/** 同梱した索引を読み、索引の文を `hookSpecificOutput` の JSON にして標準出力に 1 行書く。読めなければ標準出力には何も書かず、標準エラーに理由を書いて 1 を返す */
export async function runSessionStart(options: {
  /** このファイルのあるフォルダ（`plugin/scripts`） */
  moduleDir: string;
  /** 標準出力へ 1 行書く */
  stdout: (line: string) => void;
  /** 標準エラーへ 1 行書く */
  stderr: (line: string) => void;
}): Promise<0 | 1> {
  const { moduleDir, stdout, stderr } = options;
  let additionalContext: string;
  try {
    const entries = await readGuideIndex(
      join(resolve(moduleDir, ".."), GUIDE_DIR),
    );
    additionalContext = formatGuideContext(entries);
  } catch (error) {
    if (error instanceof CliError) {
      stderr(error.message);
      return 1;
    }
    throw error;
  }
  stdout(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext },
    }),
  );
  return 0;
}

// 束ねた `plugin/scripts/session-start.js` を入口として実行されたときだけ流す
if (import.meta.main) {
  process.exitCode = await runSessionStart({
    moduleDir: import.meta.dirname,
    stdout: (line) => console.log(line),
    stderr: (line) => console.error(line),
  });
}
