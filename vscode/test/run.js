// PoC: VS Code を落として起動し、見本のフォルダを開いて検証を流す
const path = require("node:path");
const { runTests } = require("@vscode/test-electron");

async function main() {
  const root = path.resolve(__dirname, "..");
  await runTests({
    extensionDevelopmentPath: root,
    extensionTestsPath: path.join(__dirname, "suite.js"),
    launchArgs: [path.join(root, "sample"), "--disable-extensions", "--disable-workspace-trust"],
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
