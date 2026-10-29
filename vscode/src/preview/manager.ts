import {
  type TextDocument,
  type TextEditorVisibleRangesChangeEvent,
  Uri,
  type ViewColumn,
  window,
  workspace,
} from "vscode";
import { resolveConfigPath } from "../config.ts";
import type { ExtensionDeps } from "../deps.ts";
import type { InspectedElement } from "../messages.ts";
import { readSettings } from "../settings.ts";
import { baseDirOf } from "../workspace.ts";
import { PreviewPanel } from "./panel.ts";

/** `window.createWebviewPanel` に渡す viewType */
export const VIEW_TYPE = "mdmark.preview";

/** 開く列 */
export type OpenColumn = ViewColumn.Beside | ViewColumn.Active;

/** 変わった設定ファイルか、設定の変更 */
export type ConfigChange =
  | { kind: "file"; path: string }
  | { kind: "setting"; affects: (section: string, scope: Uri) => boolean };

/** Markdown の URI ごとに 1 つの `PreviewPanel` を持ち、コマンドの対象を決め、エディタ・設定・設定ファイルの変更をパネルへ振り分ける */
export class PreviewManager {
  /** Markdown の URI の文字列 → パネル */
  private readonly panels = new Map<string, PreviewPanel>();
  /** 拡張機能の共通の依存 */
  private readonly deps: ExtensionDeps;
  /** パネルの数が変わったときに呼ぶ関数 */
  private readonly onPanelsChange: () => void;
  /** 最後に表に出たパネル */
  private lastActive: PreviewPanel | undefined;

  constructor(options: { deps: ExtensionDeps; onPanelsChange?: () => void }) {
    this.deps = options.deps;
    this.onPanelsChange = options.onPanelsChange ?? (() => {});
  }

  /** 開いているパネルの数 */
  get count(): number {
    return this.panels.size;
  }

  /** 渡された URI、無ければフォーカスのある mdmark のプレビューの Markdown、無ければアクティブなエディタの文書を返す */
  targetUri(uri: Uri | undefined): Uri | undefined {
    if (uri !== undefined) {
      return uri;
    }
    const focused = [...this.panels.values()].find((panel) => panel.active);
    return focused?.uri ?? window.activeTextEditor?.document.uri;
  }

  /** プレビューを開く。同じ Markdown のパネルがあれば今の列のまま表に出し、無ければ作って読み込ませる */
  async open(options: { uri?: Uri; column: OpenColumn }): Promise<void> {
    const uri = this.targetUri(options.uri);
    if (uri === undefined) {
      return;
    }
    const document = await workspace.openTextDocument(uri);
    if (document.languageId !== "markdown") {
      return;
    }
    const key = uri.toString();
    const existing = this.panels.get(key);
    if (existing !== undefined) {
      existing.reveal();
      this.lastActive = existing;
      return;
    }
    const folder = baseDirOf(uri);
    const webviewPanel = window.createWebviewPanel(
      VIEW_TYPE,
      `プレビュー ${uriBaseName(document)}`,
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
      deps: this.deps,
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
      if (this.lastActive === panel) {
        this.lastActive = undefined;
      }
      this.onPanelsChange();
    });
    this.onPanelsChange();
    await panel.load();
  }

  /** 対象のパネルを読み込み直す。パネルが無ければ何もしない */
  async refresh(uri?: Uri): Promise<void> {
    const target = this.targetUri(uri);
    const panel =
      target === undefined ? undefined : this.panels.get(target.toString());
    await panel?.load();
  }

  /** 文書の変更を、その Markdown のパネルへ渡す。`liveUpdate` が `true` なら変更で待ちを始め、`false` なら保存で待たずに送る */
  handleDocumentChange(event: {
    document: TextDocument;
    saved: boolean;
  }): void {
    const panel = this.panels.get(event.document.uri.toString());
    if (panel === undefined) {
      return;
    }
    const configuration = workspace.getConfiguration(
      "mdmark",
      event.document.uri,
    );
    const settings = readSettings((key) => configuration.get(key));
    if (settings.liveUpdate && !event.saved) {
      panel.scheduleRender();
    } else if (!settings.liveUpdate && event.saved) {
      panel.renderNow();
    }
  }

  /** 設定ファイルの作成・変更・削除と、`mdmark.configPath`・`mdmark.preview.theme`・`mdmark.colorTheme` の変更を受け、影響するパネルに設定を読み直させて待たずに送らせる。`libraries` の origin の集まりが CSP に入れたものと違うパネルは、HTML を入れ直す */
  handleConfigChange(change: ConfigChange): void {
    for (const panel of this.panels.values()) {
      if (!this.affects(change, panel.uri)) {
        continue;
      }
      void panel.applyConfigChange();
    }
  }

  /** 変更がこのパネルの Markdown に影響するか */
  private affects(change: ConfigChange, uri: Uri): boolean {
    if (change.kind === "setting") {
      return (
        change.affects("mdmark.configPath", uri) ||
        change.affects("mdmark.preview.theme", uri) ||
        change.affects("mdmark.colorTheme", uri)
      );
    }
    const configuration = workspace.getConfiguration("mdmark", uri);
    const settings = readSettings((key) => configuration.get(key));
    return (
      resolveConfigPath({
        configPath: settings.configPath,
        baseDir: baseDirOf(uri),
      }) === change.path
    );
  }

  /** エディタの見えている範囲を、その文書のパネルに渡す */
  handleVisibleRanges(event: TextEditorVisibleRangesChangeEvent): void {
    const panel = this.panels.get(event.textEditor.document.uri.toString());
    const range = event.visibleRanges[0];
    if (panel === undefined || range === undefined) {
      return;
    }
    panel.syncFromEditor({ start: range.start.line, end: range.end.line });
  }

  /** 最後に表に出たパネルの要素を調べる（テストのときだけ `activate` が返す） */
  async inspectPreview(selector: string): Promise<InspectedElement[]> {
    const panel = this.lastActive;
    if (panel === undefined) {
      throw new Error("開いているプレビューが無い");
    }
    return panel.inspect(selector);
  }
}

/** タブの題に出す Markdown のファイル名 */
function uriBaseName(document: TextDocument): string {
  return document.uri.path.split("/").at(-1) ?? document.uri.path;
}
