import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { CliError } from "./errors.ts";

const execFileAsync = promisify(execFile);

/** 比べる基準を引けないときの文。ref を直すか、履歴を取得する直し方を添える */
function unresolvableBase(base: string, reason: string): CliError {
  return new CliError(
    `比べる基準 ${base} を引けません（${reason}）。ref を直すか、履歴を取得してください（CI の checkout は fetch-depth: 0）。`,
  );
}

/** フォルダで git を 1 回呼び、標準出力を返す。引数は配列で渡し、シェルを通さない。失敗したら `base` を引けない誤りにする */
async function runGit(options: {
  cwd: string;
  base: string;
  args: string[];
}): Promise<string> {
  const { cwd, base, args } = options;
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      maxBuffer: Number.POSITIVE_INFINITY,
    });
    return stdout;
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stderr?: string };
    if (failure.code === "ENOENT") {
      throw unresolvableBase(base, "git が見つかりません");
    }
    const reason = (failure.stderr ?? failure.message).trim().split("\n")[0];
    throw unresolvableBase(base, reason || "git が失敗しました");
  }
}

/** NUL 区切りの出力を、空の要素を除いたパスの並びにする */
function splitPaths(output: string): string[] {
  return output.split("\0").filter((path) => path !== "");
}

/** git の ref と HEAD の merge-base から作業ツリーまでに変わったファイルと、git が管理していない新しいファイルを、索引のフォルダからの相対パス（区切りは `/`）で返す */
export async function changedPathsSince(options: {
  /** git を呼ぶフォルダ（設定ファイルのフォルダ） */
  cwd: string;
  /** 比べる基準の ref */
  base: string;
  /** 索引のファイルのフォルダの絶対パス */
  indexDir: string;
}): Promise<string[]> {
  const { cwd, base, indexDir } = options;
  // `-` で始まる ref は git のオプションと読まれるため、引けないものとして扱う
  if (base.startsWith("-")) {
    throw unresolvableBase(base, "ref が - で始まっています");
  }
  const top = (
    await runGit({ cwd, base, args: ["rev-parse", "--show-toplevel"] })
  ).trim();
  const mergeBase = (
    await runGit({ cwd: top, base, args: ["merge-base", base, "HEAD"] })
  ).trim();
  const changed = splitPaths(
    await runGit({
      cwd: top,
      base,
      args: ["diff", "--name-only", "-z", mergeBase, "--"],
    }),
  );
  const added = splitPaths(
    await runGit({
      cwd: top,
      base,
      args: ["ls-files", "--others", "--exclude-standard", "-z"],
    }),
  );
  // パスの解き方が環境で揺れないよう、リポジトリの直下と索引のフォルダを実体のパスにそろえる
  const realTop = await realpath(top);
  const realIndexDir = await realpath(indexDir);
  const paths = new Set(
    [...changed, ...added].map((path) =>
      relative(realIndexDir, resolve(realTop, path)).split(sep).join("/"),
    ),
  );
  return [...paths];
}
