import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type ExtensionContext, Uri, ViewColumn, window } from "vscode";

/** PoC: 束ねたコードを拡張機能の保存場所のファイルに書き、プレビューと同じ形の CSP の Webview で import させ、既定の export の `name` を受け取る */
export const importInWebview = async (options: {
  context: ExtensionContext;
  code: string;
}): Promise<string> => {
  const directory = join(options.context.globalStorageUri.fsPath, "extensions");
  await mkdir(directory, { recursive: true });
  const file = join(directory, "bundle-0.mjs");
  await writeFile(file, options.code);
  const panel = window.createWebviewPanel("mdmark.poc", "PoC", ViewColumn.One, {
    enableScripts: true,
    localResourceRoots: [Uri.file(directory)],
  });
  const nonce = randomBytes(16).toString("base64");
  const url = panel.webview.asWebviewUri(Uri.file(file)).toString();
  const csp = `default-src 'none'; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net ${panel.webview.cspSource}; style-src ${panel.webview.cspSource} 'unsafe-inline'; connect-src https://cdn.jsdelivr.net`;
  try {
    const received = new Promise<string>((resolveName) => {
      panel.webview.onDidReceiveMessage((message: { name: string }) => {
        resolveName(message.name);
      });
    });
    panel.webview.html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}"></head><body><script type="module" nonce="${nonce}">
const api = acquireVsCodeApi();
import(${JSON.stringify(url)}).then(
  (module) => api.postMessage({ name: String(module.default?.name) + ":" + String(module.default?.marker?.()) }),
  (error) => api.postMessage({ name: "error:" + String(error) }),
);
</script></body></html>`;
    return await received;
  } finally {
    panel.dispose();
  }
};
