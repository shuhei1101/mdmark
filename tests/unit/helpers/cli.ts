import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach } from "vitest";
import type { ExportPayload } from "../../../src/cli/html.ts";

/** テストが渡す CLI の入出力 */
export type TestIo = {
  cwd: string;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
};

/** 書き出した HTML に埋まる中身 */
export type PayloadView = ExportPayload;

/** テストごとに作った一時フォルダを消す。一時フォルダを作る関数を返す */
export function useTempDirs(): () => Promise<string> {
  const created: string[] = [];
  afterEach(async () => {
    await Promise.all(
      created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });
  return async () => {
    const dir = await mkdtemp(join(tmpdir(), "mdmark-cli-"));
    created.push(dir);
    return dir;
  };
}

/** フォルダの下にファイルを書く（親のフォルダは作る） */
export async function writeFiles(
  root: string,
  files: Record<string, string | Uint8Array>,
): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    const file = join(root, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content);
  }
}

/** 出力を配列に貯める入出力を作る */
export function createIo(cwd: string): {
  io: TestIo;
  stdout: string[];
  stderr: string[];
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    io: {
      cwd,
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line),
    },
    stdout,
    stderr,
  };
}

/** 書き出した HTML から、埋めた中身（`#mdmark-payload` の JSON）を読む */
export function readPayload(html: string): PayloadView {
  const match =
    /<script[^>]*id="mdmark-payload"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!match?.[1]) {
    throw new Error("#mdmark-payload が無い");
  }
  return JSON.parse(match[1]) as PayloadView;
}

/** 中身を短くした dist/ を置き、そのフォルダの絶対パスを返す */
export async function writeDist(root: string): Promise<string> {
  await writeFiles(root, {
    "dist/index.css": "/* dist css */",
    "dist/viewer.js": "console.log(1);",
  });
  return join(root, "dist");
}

/** ずれの無い索引（文書 a・b を載せる） */
export const CLEAN_INDEX = [
  "schema: 1",
  "docs:",
  "  - id: a",
  "    path: a.md",
  "    title: A",
  "  - id: b",
  "    path: b.md",
  "    title: B",
  "",
].join("\n");
