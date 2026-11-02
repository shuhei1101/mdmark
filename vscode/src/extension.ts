import { basename, dirname } from "node:path";
import {
  commands,
  type ExtensionContext,
  ExtensionMode,
  type FileSystemWatcher,
  RelativePattern,
  type Uri,
  ViewColumn,
  window,
  workspace,
} from "vscode";
import { resolveConfigPath } from "./config.ts";
import { openConfigFile } from "./config-file.ts";
import type { ExtensionDeps } from "./deps.ts";
import { type ExportMode, exportMarkdown } from "./export/export.ts";
import type { Logger } from "./log.ts";
import type { InspectedElement } from "./messages.ts";
import { DIST_BASE } from "./preview/html.ts";
import { PreviewManager } from "./preview/manager.ts";
import { readSettings } from "./settings.ts";
import { TAGS_URL } from "./version.ts";
import { baseDirOf } from "./workspace.ts";

/** テストのときの戻り値: 結合テストが Webview の DOM を確かめる口 */
export type TestApi = {
  /** 最後に表に出たパネルの要素を調べる */
  inspectPreview: (
    selector: string,
    play?: boolean,
  ) => Promise<InspectedElement[]>;
};

/** パネルが 1 つ以上開いているかを書くコンテキストキー */
const PREVIEW_OPEN_CONTEXT = "mdmark.previewOpen";

/** テストのときだけ読む、配布物の配信元とタグ一覧の取得先を差し替える環境変数 */
const DIST_BASE_ENV = "MDMARK_VSCODE_DIST_BASE";
const TAGS_URL_ENV = "MDMARK_VSCODE_TAGS_URL";

/** コマンドの引数の URI。エディタのタイトルのボタンからは VS Code が文書の URI を渡す */
function uriArgument(value: unknown): Uri | undefined {
  return typeof value === "object" && value !== null && "fsPath" in value
    ? (value as Uri)
    : undefined;
}

/** 設定ファイルの作成・変更・削除を見張る。ワークスペースのフォルダごとに、`mdmark.configPath` の場所を見る */
function watchConfigFiles(onChange: (path: string) => void): {
  dispose: () => void;
} {
  const watchers: FileSystemWatcher[] = [];
  const create = () => {
    for (const watcher of watchers.splice(0)) {
      watcher.dispose();
    }
    for (const folder of workspace.workspaceFolders ?? []) {
      const configuration = workspace.getConfiguration("mdmark", folder.uri);
      const settings = readSettings((key) => configuration.get(key));
      const path = resolveConfigPath({
        configPath: settings.configPath,
        baseDir: folder.uri.fsPath,
      });
      const watcher = workspace.createFileSystemWatcher(
        new RelativePattern(dirname(path), basename(path)),
      );
      const notify = (uri: Uri) => {
        onChange(uri.fsPath);
      };
      watcher.onDidCreate(notify);
      watcher.onDidChange(notify);
      watcher.onDidDelete(notify);
      watchers.push(watcher);
    }
  };
  create();
  const configurationListener = workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("mdmark.configPath")) {
      create();
    }
  });
  const foldersListener = workspace.onDidChangeWorkspaceFolders(create);
  return {
    dispose: () => {
      for (const watcher of watchers.splice(0)) {
        watcher.dispose();
      }
      configurationListener.dispose();
      foldersListener.dispose();
    },
  };
}

/** コマンドと VS Code の知らせを登録し、テストのときだけ `TestApi` を返す */
export function activate(context: ExtensionContext): TestApi | undefined {
  const test = context.extensionMode === ExtensionMode.Test;
  const output = window.createOutputChannel("mdmark", { log: true });
  const log: Logger = output;
  const deps: ExtensionDeps = {
    context,
    distBase: (test ? process.env[DIST_BASE_ENV] : undefined) ?? DIST_BASE,
    tagsUrl: (test ? process.env[TAGS_URL_ENV] : undefined) ?? TAGS_URL,
    test,
    log,
  };
  const manager = new PreviewManager({
    deps,
    onPanelsChange: () => {
      void commands.executeCommand(
        "setContext",
        PREVIEW_OPEN_CONTEXT,
        manager.count > 0,
      );
    },
  });
  /** 書き出すコマンドの本体: 対象の Markdown を開いて書き出す */
  const exportCommand = (mode: ExportMode) => async (uri?: unknown) => {
    const target = manager.targetUri(uriArgument(uri));
    if (target === undefined) {
      return;
    }
    const document = await workspace.openTextDocument(target);
    if (document.languageId !== "markdown") {
      return;
    }
    await exportMarkdown({ document, mode, deps });
  };
  context.subscriptions.push(
    output,
    commands.registerCommand("mdmark.openPreviewToSide", (uri?: unknown) =>
      manager.open({ uri: uriArgument(uri), column: ViewColumn.Beside }),
    ),
    commands.registerCommand("mdmark.openPreview", (uri?: unknown) =>
      manager.open({ uri: uriArgument(uri), column: ViewColumn.Active }),
    ),
    commands.registerCommand("mdmark.refreshPreview", (uri?: unknown) =>
      manager.refresh(uriArgument(uri)),
    ),
    commands.registerCommand("mdmark.openConfig", async (uri?: unknown) => {
      const target = manager.targetUri(uriArgument(uri));
      const scope = target ?? workspace.workspaceFolders?.[0]?.uri;
      const configuration = workspace.getConfiguration("mdmark", scope);
      const settings = readSettings((key) => configuration.get(key));
      const baseDir =
        target !== undefined
          ? baseDirOf(target)
          : (workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd());
      await openConfigFile({ configPath: settings.configPath, baseDir, log });
    }),
    commands.registerCommand("mdmark.openSettings", () =>
      commands.executeCommand(
        "workbench.action.openSettings",
        `@ext:${context.extension.id}`,
      ),
    ),
    commands.registerCommand("mdmark.exportHtml", exportCommand("export")),
    commands.registerCommand("mdmark.openInBrowser", exportCommand("browser")),
    commands.registerCommand("mdmark.printToPdf", exportCommand("print")),
    workspace.onDidChangeTextDocument((event) => {
      manager.handleDocumentChange({ document: event.document, saved: false });
    }),
    workspace.onDidSaveTextDocument((document) => {
      manager.handleDocumentChange({ document, saved: true });
    }),
    workspace.onDidChangeConfiguration((event) => {
      manager.handleConfigChange({
        kind: "setting",
        affects: (section, scope) => event.affectsConfiguration(section, scope),
      });
    }),
    window.onDidChangeTextEditorVisibleRanges((event) => {
      manager.handleVisibleRanges(event);
    }),
    watchConfigFiles((path) => {
      manager.handleConfigChange({ kind: "file", path });
    }),
  );
  if (!test) {
    return undefined;
  }
  return {
    inspectPreview: (selector, play) => manager.inspectPreview(selector, play),
  };
}
