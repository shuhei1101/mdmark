import { dirname } from "node:path";
import { type Uri, workspace } from "vscode";

/** Markdown を含むワークスペースのフォルダ。ワークスペースの外の Markdown は Markdown のフォルダ。相対パスの設定の基準になる */
export function baseDirOf(uri: Uri): string {
  return workspace.getWorkspaceFolder(uri)?.uri.fsPath ?? dirname(uri.fsPath);
}
