// PoC: 拡張機能の操作の口から検証を流し、結果を出力する（合否の判定は結果を読んで行う）
const vscode = require("vscode");

async function run() {
  const ext = vscode.extensions.getExtension("mdmark-poc.mdmark-poc");
  const api = await ext.activate();
  const report = await api.runAndWrite(vscode.workspace.workspaceFolders[0].uri);
  console.log(JSON.stringify(report, null, 2));
}

module.exports = { run };
