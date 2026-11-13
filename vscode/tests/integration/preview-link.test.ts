import * as assert from "node:assert";
import { join } from "node:path";
import * as vscode from "vscode";
import {
  clickInPreview,
  deliver,
  dragInPreview,
  inspect,
  installMessages,
  installOpenExternal,
  installRecorder,
  lastPanel,
  opened,
  openMarkdown,
  resetEnvironment,
  setSetting,
  sleep,
  waitFor,
  waitForRendered,
  workspaceDir,
  writeFixture,
} from "./helpers.ts";

/** リンクを持つ文書のプレビューを開く（見出しへの `#` のリンクと、無いファイルへのリンクを含む） */
async function openLinkGuide() {
  await writeFixture(
    "guide.md",
    [
      "# 案内",
      "",
      "[外部](https://example.com/)",
      "",
      "[別の文書](./other.md)",
      "",
      "[ページ内](#末尾)",
      "",
      "[無い文書](./missing.md)",
      "",
      "## 末尾",
      "",
    ].join("\n"),
  );
  await writeFixture("other.md", "# 別の文書\n");
  const editor = await openMarkdown("guide.md");
  await vscode.commands.executeCommand("mdmark.openPreviewToSide");
  const record = lastPanel();
  await waitForRendered(record);
  return { editor, record };
}

suite("プレビューのリンクを開く", () => {
  suiteSetup(() => {
    installRecorder();
    installMessages();
    installOpenExternal();
  });
  teardown(resetEnvironment);

  // 外部の URL を既定のブラウザで開く
  test("test_normal_when_external_link", async () => {
    // 準備
    const { record } = await openLinkGuide();
    const sentBefore = record.sent.length;
    // 実行: 外部の URL のリンクを押したことにする
    deliver(record, { type: "openLink", href: "https://example.com/" });
    // 検証
    await waitFor(() => opened.length === 1);
    assert.deepStrictEqual(opened, ["https://example.com/"]);
    assert.strictEqual(record.sent.length, sentBefore);
  });

  // .md へのリンクを VS Code のエディタで開く
  test("test_normal_when_markdown_link", async () => {
    // 準備
    const { editor, record } = await openLinkGuide();
    // 実行
    deliver(record, { type: "openLink", href: "./other.md#使い方" });
    // 検証
    await waitFor(
      () =>
        vscode.window.activeTextEditor?.document.uri.fsPath ===
        join(workspaceDir(), "other.md"),
      { message: "other.md が開かない" },
    );
    assert.strictEqual(
      vscode.window.activeTextEditor?.viewColumn,
      editor.viewColumn,
    );
    assert.deepStrictEqual(opened, []);
  });

  // `#` で始まるリンクはプレビューの中で移り、拡張機能へは送信しない
  test("test_normal_when_anchor_link", async () => {
    // 準備: リンク先の見出しが画面の外にある長い文書。スクロールの同期は切り、リンクの移動だけを確認する
    await setSetting("preview.scrollPreviewWithEditor", false);
    await setSetting("preview.scrollEditorWithPreview", false);
    await writeFixture(
      "long.md",
      [
        "# 案内",
        "",
        "[末尾へ](#末尾)",
        "",
        ...Array.from({ length: 200 }, (_, index) => [
          `段落 ${index + 1}`,
          "",
        ]).flat(),
        "## 末尾",
        "",
        // 見出しが先頭まで上がれるよう、後ろにも続ける
        ...Array.from({ length: 200 }, (_, index) => [
          `後の段落 ${index + 1}`,
          "",
        ]).flat(),
      ].join("\n"),
    );
    const editor = await openMarkdown("long.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    const headingTop = async () =>
      (await inspect("h2")).find((item) => item.text.includes("末尾"))?.top;
    assert.ok(((await headingTop()) ?? 0) > 3000, "見出しが画面の中にある");
    const editors = vscode.window.visibleTextEditors.length;
    // 実行: リンクを押す
    clickInPreview(record, 'a[href="#末尾"]');
    // 検証: 見出しが見えている範囲の先頭に入る
    await waitFor(
      async () => {
        const top = await headingTop();
        return top !== undefined && top > -2 && top < 100;
      },
      { message: "見出しへ移らない" },
    );
    await sleep(300);
    assert.strictEqual(
      record.received.filter((message) => message.type === "openLink").length,
      0,
    );
    assert.strictEqual(vscode.window.visibleTextEditors.length, editors);
    assert.deepStrictEqual(
      vscode.window.visibleTextEditors.map((item) => item.document.uri.fsPath),
      [editor.document.uri.fsPath],
    );
    assert.deepStrictEqual(opened, []);
  });

  // 右側の目次の項目を押すと、囲む閉じたセクションと見出し自身の閉じたセクションを開いて見出しへ移り、拡張機能へは送信しない
  test("test_normal_when_side_toc_link", async () => {
    // 準備: 閉じたセクションの中の見出しが画面の外にある長い文書。スクロールの同期は切り、リンクの移動だけを確認する
    await setSetting("preview.scrollPreviewWithEditor", false);
    await setSetting("preview.scrollEditorWithPreview", false);
    const filler = (label: string) =>
      Array.from({ length: 200 }, (_, index) => [
        `${label} ${index + 1}`,
        "",
      ]).flat();
    await writeFixture(
      "guide.md",
      [
        "# 案内",
        "",
        ...filler("段落"),
        "## 導入",
        "",
        "<!-- section: closed -->",
        "",
        "### 注意",
        "",
        "<!-- section: closed -->",
        "",
        "注意の段落",
        "",
        ...filler("後の段落"),
      ].join("\n"),
    );
    await openMarkdown("guide.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    const sectionBody = async (id = "導入") =>
      (await inspect(`[id="section-${id}"]`))[0];
    assert.ok(
      "hidden" in ((await sectionBody())?.attributes ?? {}),
      "導入のセクションが閉じていない",
    );
    // 実行: 右側の目次の「注意」を押す
    clickInPreview(record, 'aside.mdmark-side-toc a[data-heading-id="注意"]');
    // 検証: 導入と注意のセクションが開き、注意の見出しが見えている範囲に入り、注意の段落が表示されている
    await waitFor(
      async () => {
        const top = (await inspect("h3")).find((item) =>
          item.text.includes("注意"),
        )?.top;
        return top !== undefined && top > -2 && top < 400;
      },
      { message: "注意の見出しへ移らない" },
    );
    assert.ok(!("hidden" in ((await sectionBody())?.attributes ?? {})));
    assert.ok(!("hidden" in ((await sectionBody("注意"))?.attributes ?? {})));
    const note = (await inspect("p")).find(
      (item) => item.text === "注意の段落",
    );
    assert.ok((note?.height ?? 0) > 0, "注意の段落が表示されていない");
    await sleep(300);
    assert.strictEqual(
      record.received.filter((message) => message.type === "openLink").length,
      0,
    );
    assert.deepStrictEqual(opened, []);
  });

  // 相対パスの先にファイルが無いときは何も開かない
  test("test_error_when_link_target_missing", async () => {
    // 準備
    const { record } = await openLinkGuide();
    const editors = vscode.window.visibleTextEditors.length;
    const tabs = vscode.window.tabGroups.all.flatMap(
      (group) => group.tabs,
    ).length;
    // 実行
    deliver(record, { type: "openLink", href: "./missing.md" });
    await sleep(700);
    // 検証
    assert.strictEqual(vscode.window.visibleTextEditors.length, editors);
    assert.strictEqual(
      vscode.window.tabGroups.all.flatMap((group) => group.tabs).length,
      tabs,
    );
    assert.deepStrictEqual(opened, []);
  });

  // map の図のノードのリンクを、本文のリンクと同じ種類ごとの先で開き、ノードの上のドラッグでは開かない
  test("test_normal_when_map_node_link", async () => {
    // 準備
    await writeFixture(
      "flow.md",
      [
        "# 図",
        "",
        "<!-- map -->",
        "",
        "```mermaid",
        "flowchart LR",
        '  doc["ノード doc"]',
        '  web["ノード web"]',
        "  doc --> web",
        '  click doc "./other.md"',
        '  click web "https://aka.ms/mdmark"',
        "```",
        "",
        "<!-- /map -->",
        "",
      ].join("\n"),
    );
    await writeFixture("other.md", "# 別の文書\n");
    await openMarkdown("flow.md");
    await vscode.commands.executeCommand("mdmark.openPreviewToSide");
    const record = lastPanel();
    await waitForRendered(record);
    const sentBefore = record.sent.length;
    const linkOf = (id: string) =>
      `[data-node="${id}"] a.mdmark-diagram-node-link`;
    await waitFor(async () => (await inspect(linkOf("web"))).length === 1, {
      message: "map のノードのリンクが描かれていない",
    });
    // 実行・検証: 外部の URL のノードの上でドラッグすると、ノードを動かして開かない
    const styleOf = async () =>
      (await inspect('.mdmark-diagram-node[data-node="web"]'))[0]?.attributes
        .style;
    const before = await styleOf();
    dragInPreview(record, linkOf("web"), 100);
    await sleep(500);
    assert.notStrictEqual(await styleOf(), before);
    assert.strictEqual(
      record.received.filter((message) => message.type === "openLink").length,
      0,
    );
    assert.deepStrictEqual(opened, []);
    // 実行・検証: 外部の URL のノードを押すと、既定のブラウザで 1 回だけ開く
    clickInPreview(record, linkOf("web"));
    await waitFor(() => opened.length === 1);
    await sleep(300);
    assert.deepStrictEqual(opened, ["https://aka.ms/mdmark"]);
    // 実行・検証: Markdown のノードを押すと、エディタで開く
    clickInPreview(record, linkOf("doc"));
    await waitFor(
      () =>
        vscode.window.activeTextEditor?.document.uri.fsPath ===
        join(workspaceDir(), "other.md"),
      { message: "other.md が開かない" },
    );
    assert.strictEqual(
      record.sent.filter((message) => message.type === "render").length,
      record.sent
        .slice(0, sentBefore)
        .filter((message) => message.type === "render").length,
    );
  });
});
