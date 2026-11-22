import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir as osTmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isMarkMarkdown } from "../knowledge/paths.ts";
import { loadPrompt, PromptError, renderPrompt } from "./prompt.ts";

/** 案内したセッションを記録するフォルダを指定する環境変数 */
export const NOTICE_DIR_ENV = "MDMARK_GUIDE_NOTICE_DIR";

/** `NOTICE_DIR_ENV` が無いときに一時フォルダの下に作るフォルダの名前 */
export const DEFAULT_NOTICE_DIR_NAME = "mdmark-guide-notice";

/** 記録のファイル名にする `session_id` の書式 */
export const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** UserPromptSubmit の `prompt` が大文字・小文字を区別せずに含むと案内する語 */
export const PROMPT_KEYWORD = "mdmark";

/** 案内の文のプロンプト（変数 `trigger` と `file_name`） */
export const PROMPT_GUIDE_NOTICE = "hooks/guide-notice";

/** 案内するきっかけ */
type NoticeHead = { trigger: "file"; fileName: string } | { trigger: "prompt" };

/** フックの標準入力の JSON のうち、案内に使用するキー */
type NoticeInput = {
  session_id?: unknown;
  hook_event_name?: unknown;
  tool_input?: unknown;
  prompt?: unknown;
};

/** 値が連想配列（`null`・配列を除くオブジェクト）か */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** 呼び出しが案内する条件に合えば案内するきっかけを、合わなければ `null` を返却する */
export const noticeHead = (input: NoticeInput): NoticeHead | null => {
  if (input.hook_event_name === "PreToolUse") {
    const path = isRecord(input.tool_input)
      ? input.tool_input.file_path
      : undefined;
    if (typeof path === "string" && isMarkMarkdown(path)) {
      return { trigger: "file", fileName: basename(path) };
    }
    return null;
  }
  if (
    input.hook_event_name === "UserPromptSubmit" &&
    typeof input.prompt === "string" &&
    input.prompt.toLowerCase().includes(PROMPT_KEYWORD)
  ) {
    return { trigger: "prompt" };
  }
  return null;
};

/** 標準入力を JSON として読み込む。読めなければ `null` */
const parseInput = (text: string): NoticeInput | null => {
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
};

/** 記録のファイルを作る。既にある・作れないなら `false` */
const createRecord = async (options: {
  dir: string;
  path: string;
}): Promise<boolean> => {
  try {
    await mkdir(options.dir, { recursive: true });
    await writeFile(options.path, "", { flag: "wx" });
    return true;
  } catch {
    return false;
  }
};

/** 案内の文を描く。プロンプトファイルを読み込めない・描けないときは undefined */
const renderNotice = async (options: {
  root: string;
  head: NoticeHead;
}): Promise<string | undefined> => {
  const { head } = options;
  try {
    const prompt = await loadPrompt({
      root: options.root,
      id: PROMPT_GUIDE_NOTICE,
    });
    return renderPrompt(prompt, {
      trigger: head.trigger,
      file_name: head.trigger === "file" ? head.fileName : undefined,
    });
  } catch (error) {
    if (error instanceof PromptError) return undefined;
    throw error;
  }
};

/** 標準入力の `hook_event_name` で振り分け、PreCompact は記録を削除し、PreToolUse・UserPromptSubmit は案内する条件に合って記録が無いときだけ記録を作ってから `additionalContext` を標準出力に 1 行書く。どの場合も 0 を返却する */
export const runGuideNotice = async (options: {
  env: NodeJS.ProcessEnv;
  input: string;
  stdout: (line: string) => void;
  tmpdir: () => string;
  /** プラグインのルート */
  root: string;
}): Promise<0> => {
  const input = parseInput(options.input);
  if (
    input === null ||
    typeof input.session_id !== "string" ||
    !SESSION_ID_PATTERN.test(input.session_id)
  ) {
    return 0;
  }
  const dir =
    options.env[NOTICE_DIR_ENV] ||
    join(options.tmpdir(), DEFAULT_NOTICE_DIR_NAME);
  const path = join(dir, input.session_id);
  if (input.hook_event_name === "PreCompact") {
    await rm(path, { force: true }).catch(() => undefined);
    return 0;
  }
  const head = noticeHead(input);
  if (head === null) return 0;
  const context = await renderNotice({ root: options.root, head });
  if (context === undefined || !(await createRecord({ dir, path }))) {
    return 0;
  }
  options.stdout(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: input.hook_event_name,
        additionalContext: context,
      },
    }),
  );
  return 0;
};

/** 標準入力を最後まで読み込む */
const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
};

// まとめた `plugin/scripts/guide-notice.js` を入口として実行されたときだけ実行する
if (import.meta.main) {
  process.exitCode = await runGuideNotice({
    env: process.env,
    input: await readStdin(),
    stdout: (line) => console.log(line),
    tmpdir: osTmpdir,
    root: dirname(dirname(fileURLToPath(import.meta.url))),
  });
}
