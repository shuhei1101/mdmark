import { readFileSync } from "node:fs";
import { join } from "node:path";

/** 拡張機能のタグの形: `vscode-v{X}.{Y}.{Z}` */
export const RELEASE_TAG_PATTERN = /^vscode-v(\d+\.\d+\.\d+)$/;

/** タグが `RELEASE_TAG_PATTERN` に合い、`vscode-v` の後ろが `package.json` の `version` と等しいかを返す */
export function checkReleaseTag(options: {
  /** push されたタグ */
  tag: string;
  /** `package.json` の `version` */
  version: string;
}): { ok: true } | { ok: false; message: string } {
  const { tag, version } = options;
  const tagVersion = RELEASE_TAG_PATTERN.exec(tag)?.[1];
  if (tagVersion === undefined) {
    return {
      ok: false,
      message: `タグ ${tag} は vscode-v{X}.{Y}.{Z} の形ではありません`,
    };
  }
  if (tagVersion !== version) {
    return {
      ok: false,
      message: `タグのバージョン ${tagVersion} が package.json の version ${version} と違います`,
    };
  }
  return { ok: true };
}

// `node scripts/release-check.ts {タグ}` で入口として実行されたときだけ流す
if (import.meta.main) {
  const packagePath = join(import.meta.dirname, "..", "package.json");
  const { version } = JSON.parse(readFileSync(packagePath, "utf8")) as {
    version: string;
  };
  const result = checkReleaseTag({ tag: process.argv[2] ?? "", version });
  if (!result.ok) {
    console.error(result.message);
    process.exitCode = 1;
  }
}
