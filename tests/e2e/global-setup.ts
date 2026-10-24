import { downloadVscode, VSCODE_EXECUTABLE_ENV } from "./vscode-binary.ts";

/** ワーカーが並ぶ前に VS Code を 1 回だけ取得し、実行ファイルの場所を環境変数でワーカーへ渡す */
export default async function globalSetup(): Promise<void> {
  process.env[VSCODE_EXECUTABLE_ENV] = await downloadVscode();
}
