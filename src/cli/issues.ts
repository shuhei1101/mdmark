import type { CheckIssue } from "./check.ts";

/** ずれを `{file}:{where}: {kind}: {message}`（`where` が空なら `{file}: {kind}: {message}`）の 1 行にする */
export const formatCheckIssue = (issue: CheckIssue): string => {
  const place =
    issue.where === "" ? issue.file : `${issue.file}:${issue.where}`;
  return `${place}: ${issue.kind}: ${issue.message}`;
};
