import { execFileSync } from "node:child_process";

/** `git rev-parse --local-env-vars` が返却する、リポジトリの場所を指す環境変数を `process.env` から除外する */
export const clearGitLocalEnv = (): void => {
  const names = execFileSync("git", ["rev-parse", "--local-env-vars"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter((name) => name !== "");
  for (const name of names) {
    delete process.env[name];
  }
};
