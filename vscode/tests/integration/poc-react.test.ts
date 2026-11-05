// PoC: Webview の描いた文書の計算済みのスタイル・CSP の違反・axe の結果を MDMARK_POC_RESULT の JSON に記録する
import * as assert from "node:assert";
import { writeFile } from "node:fs/promises";
import * as vscode from "vscode";
import type { WebviewMessage } from "../../src/messages.ts";
import {
  inspect,
  installMessages,
  installOpenExternal,
  installRecorder,
  lastPanel,
  openMarkdown,
  type RecordedPanel,
  resetEnvironment,
  stub,
  waitFor,
  waitForRendered,
  writeFixture,
} from "./helpers.ts";

const MARKDOWN = [
  "# 見出し",
  "",
  "本文の段落。",
  "",
  "- 一つ目",
  "- 二つ目",
  "",
  "1. 番号の一つ目",
  "",
  "![画像](https://example.invalid/a.png)",
  "",
].join("\n");

/** Webview に axe を実行させ、違反の ID と CSP の違反を受け取る */
const runAxe = async (
  record: RecordedPanel,
): Promise<{ violations: string[]; csp: string[] }> => {
  const id = Date.now();
  await record.postRaw({ type: "axe", id });
  let found: Extract<WebviewMessage, { type: "axed" }> | undefined;
  await waitFor(
    () => {
      found = record.received.find(
        (message): message is Extract<WebviewMessage, { type: "axed" }> =>
          message.type === "axed" && message.id === id,
      );
      return found !== undefined;
    },
    { timeout: 20000, message: "axed が届かない" },
  );
  assert.ok(found);
  return { violations: found.violations, csp: found.csp };
};

const result: Record<string, unknown> = { vscode: vscode.version };

suite("PoC: React の Webview", () => {
  suiteSetup(() => {
    installRecorder();
    installMessages();
    installOpenExternal();
  });
  teardown(resetEnvironment);
  suiteTeardown(async () => {
    const path = process.env.MDMARK_POC_RESULT;
    if (path !== undefined) {
      await writeFile(
        path.replace("{version}", vscode.version),
        JSON.stringify(result, null, 2),
      );
    }
  });

  test("test_poc_document", async () => {
    await writeFixture("poc.md", MARKDOWN);
    await openMarkdown("poc.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    const computed: Record<string, unknown> = {};
    for (const selector of [
      ".mdmark h1",
      ".mdmark p",
      ".mdmark ul",
      ".mdmark ol",
      ".mdmark li",
      ".mdmark img",
    ]) {
      const elements = await inspect(selector);
      computed[selector] = elements.map((element) => element.computed);
    }
    result.document = computed;
    if (process.env.MDMARK_POC_BASELINE === undefined) {
      result.documentAxe = await runAxe(record);
    }
  });

  test("test_poc_status", async () => {
    await stub.setMode({ tags: "ok", dist: "drop" });
    await writeFixture("poc.md", MARKDOWN);
    await openMarkdown("poc.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitFor(
      () => record.received.some((message) => message.type === "loadFailed"),
      { timeout: 30000, message: "loadFailed が届かない" },
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
    result.status = {
      alert: (await inspect('[data-slot="alert"], .mdmark-preview-notice')).map(
        (element) => ({ text: element.text, computed: element.computed }),
      ),
      button: (await inspect("button")).map((element) => ({
        className: element.className,
        computed: element.computed,
      })),
    };
    if (process.env.MDMARK_POC_BASELINE === undefined) {
      result.statusAxe = await runAxe(record);
    }
    await stub.setMode({ tags: "ok", dist: "ok" });
  });
});
