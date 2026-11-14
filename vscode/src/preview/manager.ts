import { basename, dirname, relative } from "node:path";
import {
  type FileSystemWatcher,
  RelativePattern,
  TabInputTextDiff,
  type TextDocument,
  type TextEditorVisibleRangesChangeEvent,
  Uri,
  type ViewColumn,
  window,
  workspace,
} from "vscode";
import { CONFIG_FILE } from "../../../src/config-files.ts";
import type { ExtensionDeps } from "../deps.ts";
import type { AxeViolation, InspectedElement } from "../messages.ts";
import { readSettings } from "../settings.ts";
import { baseDirOf } from "../workspace.ts";
import { panelKey, pickDiffTarget } from "./diff-target.ts";
import { PreviewPanel } from "./panel.ts";

/** `window.createWebviewPanel` に指定する viewType */
export const VIEW_TYPE = "mdmark.preview";

/** 開く列 */
export type OpenColumn = ViewColumn.Beside | ViewColumn.Active;

/** 変わった設定ファイルか、設定の変更 */
export type ConfigChange =
  | { kind: "file"; path: string }
  | { kind: "setting"; affects: (section: string, scope: Uri) => boolean };

/** Markdown の URI ごとに 1 つの `PreviewPanel` と、変更前と変更後の URI の組ごとに 1 つの差分の `PreviewPanel` を持ち、コマンドの対象を決め、エディタ・設定・設定ファイルの変更をパネルへ振り分ける */
export class PreviewManager {
  /** パネルのキー（通常のパネルは Markdown の URI の文字列、差分のパネルは変更前と変更後の組）→ パネル */
  private readonly panels = new Map<string, PreviewPanel>();
  /** 拡張機能の共通の依存 */
  private readonly deps: ExtensionDeps;
  /** パネルの数が変わったときに呼ぶ関数 */
  private readonly onPanelsChange: () => void;
  /** 最後に表に出たパネル */
  private lastActive: PreviewPanel | undefined;
  /** 見張るファイル → その `FileSystemWatcher`（各パネルの `watched` の和） */
  private readonly watchers = new Map<string, FileSystemWatcher>();

  constructor(options: { deps: ExtensionDeps; onPanelsChange?: () => void }) {
    this.deps = options.deps;
    this.onPanelsChange = options.onPanelsChange ?? (() => {});
  }

  /** 開いているパネルの数 */
  get count(): number {
    return this.panels.size;
  }

  /** 指定された URI、無ければフォーカスのある mdmark のプレビューの Markdown、無ければアクティブなエディタの文書を返却する */
  targetUri(uri: Uri | undefined): Uri | undefined {
    if (uri !== undefined) {
      return uri;
    }
    const focused = [...this.panels.values()].find((panel) => panel.active);
    return focused?.uri ?? window.activeTextEditor?.document.uri;
  }

  /** プレビューする Markdown（差分ビューのときは変更前と変更後）を開く。Markdown でなければ `undefined` */
  private async openMarkdown(
    uri: Uri | undefined,
    diff: { original: string; modified: string } | undefined,
  ): Promise<{ document: TextDocument; original?: TextDocument } | undefined> {
    if (diff === undefined) {
      const target = this.targetUri(uri);
      if (target === undefined) {
        return undefined;
      }
      const document = await workspace.openTextDocument(target);
      return document.languageId === "markdown" ? { document } : undefined;
    }
    const [original, document] = await Promise.all([
      workspace.openTextDocument(Uri.parse(diff.original)),
      workspace.openTextDocument(Uri.parse(diff.modified)),
    ]);
    if (
      original.languageId !== "markdown" ||
      document.languageId !== "markdown"
    ) {
      return undefined;
    }
    return { document, original };
  }

  /** プレビューを開く。差分ビューのときは変更後の文書を色分けする差分のパネルを開く。同じ Markdown（差分は変更前と変更後の組）のパネルがあれば今の列のまま表に出し、無ければ作って読み込ませる */
  async open(options: { uri?: Uri; column: OpenColumn }): Promise<void> {
    const input = window.tabGroups.activeTabGroup.activeTab?.input;
    const diff = pickDiffTarget({
      tab:
        input instanceof TabInputTextDiff
          ? {
              original: input.original.toString(),
              modified: input.modified.toString(),
            }
          : undefined,
      uri: options.uri?.toString(),
    });
    const opened = await this.openMarkdown(options.uri, diff);
    if (opened === undefined) {
      return;
    }
    const { document, original } = opened;
    const key = panelKey({
      uri: document.uri.toString(),
      ...(diff === undefined ? {} : { original: diff.original }),
    });
    const existing = this.panels.get(key);
    if (existing !== undefined) {
      existing.reveal();
      this.lastActive = existing;
      return;
    }
    const folder = baseDirOf(
      original === undefined ? document.uri : Uri.file(document.uri.fsPath),
    );
    const webviewPanel = window.createWebviewPanel(
      VIEW_TYPE,
      `${original === undefined ? "プレビュー" : "差分プレビュー"} ${uriBaseName(document)}`,
      options.column,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [
          Uri.file(folder),
          Uri.joinPath(this.deps.context.extensionUri, "media"),
        ],
      },
    );
    const panel = new PreviewPanel({
      webviewPanel,
      document,
      ...(original === undefined ? {} : { original }),
      deps: this.deps,
      onWatchedChange: () => {
        this.syncWatchers();
      },
    });
    this.panels.set(key, panel);
    this.lastActive = panel;
    webviewPanel.onDidChangeViewState((event) => {
      if (event.webviewPanel.active) {
        this.lastActive = panel;
      }
    });
    webviewPanel.onDidDispose(() => {
      this.panels.delete(key);
      this.syncWatchers();
      if (this.lastActive === panel) {
        this.lastActive = undefined;
      }
      this.onPanelsChange();
    });
    this.onPanelsChange();
    await panel.load();
  }

  /** 対象のパネルを再読み込みする。フォーカスのあるパネル、無ければ対象の Markdown のパネル。パネルが無ければ何もしない */
  async refresh(uri?: Uri): Promise<void> {
    const focused = [...this.panels.values()].find((panel) => panel.active);
    const target = this.targetUri(uri);
    const panel =
      focused ??
      (target === undefined ? undefined : this.findPanels(target)[0]);
    await panel?.load();
  }

  /** Markdown（差分のパネルは変更後）の URI が指定した URI と同じパネルを全て返却する。通常のパネルと差分のパネルの両方が該当する。変更前の文書は該当しない */
  private findPanels(uri: Uri): PreviewPanel[] {
    return [...this.panels.values()].filter(
      (panel) => panel.uri.toString() === uri.toString(),
    );
  }

  /** 文書の変更を、その Markdown のパネルへ指定する。`liveUpdate` が `true` なら変更で待ちを始め、`false` なら保存で待たずに送信する */
  handleDocumentChange(event: {
    document: TextDocument;
    saved: boolean;
  }): void {
    // 取り込んでいるファイルを保存したパネルは、再読み込みした取り込む文書で再描画する
    if (event.saved) {
      for (const panel of this.panels.values()) {
        if (panel.readsInclude(event.document.uri.fsPath)) {
          panel.renderNow();
        }
      }
    }
    for (const panel of this.findPanels(event.document.uri)) {
      const configuration = workspace.getConfiguration("mdmark", panel.scope);
      const settings = readSettings((key) => configuration.get(key));
      if (settings.liveUpdate && !event.saved) {
        panel.scheduleRender();
      } else if (!settings.liveUpdate && event.saved) {
        panel.renderNow();
      }
    }
  }

  /** 設定ファイルの作成・変更・削除と、`mdmark.configPath`・`mdmark.preview.theme`・`mdmark.colorTheme` の変更を受け、影響するパネルに設定を再読み込みさせて待たずに送信させる。`libraries` の origin の集まりが CSP に入れたものと違うパネルは、HTML をもう一度入れる */
  handleConfigChange(change: ConfigChange): void {
    for (const panel of this.panels.values()) {
      if (!this.affects(change, panel)) {
        continue;
      }
      void panel.applyConfigChange(
        change.kind === "file" ? change.path : undefined,
      );
    }
  }

  /** 変更がこのパネルの Markdown に影響するか */
  private affects(change: ConfigChange, panel: PreviewPanel): boolean {
    if (change.kind === "setting") {
      return (
        change.affects("mdmark.configPath", panel.scope) ||
        change.affects("mdmark.preview.theme", panel.scope) ||
        change.affects("mdmark.colorTheme", panel.scope)
      );
    }
    if (panel.watched.includes(change.path)) {
      return true;
    }
    // まだ重ねていない上のフォルダの設定ファイルが作られた・変わった
    if (basename(change.path) !== CONFIG_FILE) {
      return false;
    }
    const rel = relative(dirname(change.path), panel.scope.fsPath);
    return !rel.startsWith("..");
  }

  /** 各パネルの `watched` の和に合わせて、ファイルごとの `FileSystemWatcher` を張り替える。ワークスペースの中の `mdmark.config.yaml` は拡張機能の入口の見張りに任せる（1 回の保存で 2 回当てない） */
  private syncWatchers(): void {
    const wanted = new Set(
      [...this.panels.values()]
        .flatMap((panel) => panel.watched)
        .filter(
          (path) =>
            basename(path) !== CONFIG_FILE ||
            workspace.getWorkspaceFolder(Uri.file(path)) === undefined,
        ),
    );
    for (const [path, watcher] of this.watchers) {
      if (!wanted.has(path)) {
        watcher.dispose();
        this.watchers.delete(path);
      }
    }
    for (const path of wanted) {
      if (this.watchers.has(path)) {
        continue;
      }
      const watcher = workspace.createFileSystemWatcher(
        new RelativePattern(Uri.file(dirname(path)), basename(path)),
      );
      const notify = () => {
        this.handleConfigChange({ kind: "file", path });
      };
      watcher.onDidCreate(notify);
      watcher.onDidChange(notify);
      watcher.onDidDelete(notify);
      this.watchers.set(path, watcher);
    }
  }

  /** エディタの見えている範囲を、その文書のパネルに指定する */
  handleVisibleRanges(event: TextEditorVisibleRangesChangeEvent): void {
    const range = event.visibleRanges[0];
    if (range === undefined) {
      return;
    }
    for (const panel of this.findPanels(event.textEditor.document.uri)) {
      panel.syncFromEditor({ start: range.start.line, end: range.end.line });
    }
  }

  /** 最後に表に出たパネルの要素を調べる（テストのときだけ `activate` が返却する） */
  async inspectPreview(
    selector: string,
    play = false,
  ): Promise<InspectedElement[]> {
    const panel = this.lastActive;
    if (panel === undefined) {
      throw new Error("開いているプレビューが無い");
    }
    return panel.inspect(selector, play);
  }

  /** 最後に表に出たパネルを axe で検査する（テストのときだけ `activate` が返却する） */
  async auditPreview(): Promise<AxeViolation[]> {
    const panel = this.lastActive;
    if (panel === undefined) {
      throw new Error("開いているプレビューが無い");
    }
    return panel.audit();
  }
}

/** タブのタイトルに出す Markdown のファイル名 */
function uriBaseName(document: TextDocument): string {
  return document.uri.path.split("/").at(-1) ?? document.uri.path;
}
