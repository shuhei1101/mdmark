import { readFile, stat } from "node:fs/promises";
import { dirname } from "node:path";
import {
  commands,
  env,
  Range,
  type TextDocument,
  TextEditorRevealType,
  Uri,
  ViewColumn,
  type WebviewPanel,
  window,
  workspace,
} from "vscode";
import type { PreviewConfig } from "../config.ts";
import {
  libraryOrigins,
  loadConfig,
  resolveConfigPath,
  resolveLibraries,
} from "../config.ts";
import { openConfigFile } from "../config-file.ts";
import { type ExtensionDeps, LAST_VERSION_KEY } from "../deps.ts";
import type {
  HostMessage,
  InspectedElement,
  WebviewMessage,
} from "../messages.ts";
import { readSettings } from "../settings.ts";
import {
  decideVersion,
  fetchLatestVersion,
  TAGS_TIMEOUT_MS,
} from "../version.ts";
import { baseDirOf } from "../workspace.ts";
import { buildCsp, buildPreviewHtml, createNonce, distUrl } from "./html.ts";
import { resolveLink } from "./links.ts";
import { EditorScrollGuard } from "./scroll-guard.ts";

/** `inspect` の結果を待つ上限（ミリ秒） */
const INSPECT_TIMEOUT_MS = 5000;

/** 1 つの Markdown のパネル。読むバージョンと設定を決めて HTML を入れ、Webview とメッセージをやり取りし、描き直しの待ちを 1 つだけ持つ */
export class PreviewPanel {
  /** VS Code のパネル */
  private readonly webviewPanel: WebviewPanel;
  /** 対象の Markdown */
  private readonly document: TextDocument;
  /** 拡張機能の共通の依存 */
  private readonly deps: ExtensionDeps;
  /** 最後に読めた設定（`libraries` は Webview で読める URL に直した値。読めたことが無ければ `{}`） */
  private config: PreviewConfig = {};
  /** `config` の `libraries` の URL を直す前の値（CSP に入れる origin の元） */
  private rawLibraries: Record<string, unknown> | undefined;
  /** 今の HTML の CSP に入れた `libraries` の origin（`load` が書く）。設定ファイルを読み直した後の origin と比べ、違えば HTML を入れ直す */
  private cspLibraryOrigins: string[] = [];
  /** 設定ファイルを読めていないときの読めない行 */
  private configErrorLine: number | undefined;
  /** 描き直すまでの待ち。待つ間に変更が来たら始め直す */
  private timer: NodeJS.Timeout | undefined;
  /** 今の HTML の Webview から `ready` を受けたか */
  private ready = false;
  /** 読み込むたびに増やす番号。リロードが重なったとき、後の呼び出しだけが HTML を入れる */
  private loadToken = 0;
  /** エディタを動かした直後の知らせを捨てる判定 */
  private readonly scrollGuard = new EditorScrollGuard();
  /** `inspect` の `id` → 結果を渡す関数（テストのときだけ使う） */
  private readonly pendingInspects = new Map<
    number,
    (elements: InspectedElement[]) => void
  >();
  /** 最後に HTML へ入れた配布物のバージョンと `index.js` の URL（決められなかったときは `undefined`） */
  private loaded: { version: string; distJs: string } | undefined;
  /** 次の `inspect` の `id` */
  private nextInspectId = 1;

  constructor(options: {
    webviewPanel: WebviewPanel;
    document: TextDocument;
    deps: ExtensionDeps;
  }) {
    this.webviewPanel = options.webviewPanel;
    this.document = options.document;
    this.deps = options.deps;
    this.webviewPanel.webview.onDidReceiveMessage((message: WebviewMessage) => {
      void this.handleMessage(message);
    });
    this.webviewPanel.onDidDispose(() => {
      clearTimeout(this.timer);
    });
  }

  /** パネルが表に出ているか */
  get visible(): boolean {
    return this.webviewPanel.visible;
  }

  /** パネルにフォーカスがあるか */
  get active(): boolean {
    return this.webviewPanel.active;
  }

  /** 対象の Markdown の URI */
  get uri(): Uri {
    return this.document.uri;
  }

  /** 今の列のまま表に出す */
  reveal(): void {
    this.webviewPanel.reveal();
  }

  /** 読むバージョンと設定を決め直し、Webview に HTML を入れる（開くときとリロードのとき） */
  async load(): Promise<void> {
    this.loadToken += 1;
    const token = this.loadToken;
    const { deps } = this;
    const { log } = deps;
    const configuration = workspace.getConfiguration("mdmark", this.uri);
    const settings = readSettings((key) => configuration.get(key));
    const decision = await decideVersion({
      setting: settings.version,
      lastVersion: deps.context.globalState.get<string>(LAST_VERSION_KEY),
      fetchLatest: () =>
        fetchLatestVersion({
          url: deps.tagsUrl,
          timeoutMs: TAGS_TIMEOUT_MS,
          fetch: globalThis.fetch,
          log,
        }),
      log,
    });
    if (decision.kind === "decided" && decision.fetched) {
      await deps.context.globalState.update(LAST_VERSION_KEY, decision.version);
    }
    await this.reloadConfig();
    // 後の呼び出しが始まっていたら、HTML は後の呼び出しに任せる
    if (token !== this.loadToken) {
      return;
    }
    this.ready = false;
    this.cspLibraryOrigins = libraryOrigins(this.rawLibraries);
    const webview = this.webviewPanel.webview;
    const nonce = createNonce();
    const csp = buildCsp({
      nonce,
      distOrigin: new URL(deps.distBase).origin,
      libraryOrigins: this.cspLibraryOrigins,
      cspSource: webview.cspSource,
    });
    const media = (file: string) =>
      webview
        .asWebviewUri(Uri.joinPath(deps.context.extensionUri, "media", file))
        .toString();
    const common = {
      nonce,
      csp,
      baseHref: `${webview.asWebviewUri(Uri.file(dirname(this.uri.fsPath))).toString()}/`,
      scriptUri: media("preview.js"),
      styleUri: media("preview.css"),
      configPath: settings.configPath,
      test: deps.test,
    };
    const distJs =
      decision.kind === "decided"
        ? distUrl({
            base: deps.distBase,
            version: decision.version,
            file: "index.js",
          })
        : undefined;
    this.loaded =
      decision.kind === "decided" && distJs !== undefined
        ? { version: decision.version, distJs }
        : undefined;
    webview.html =
      decision.kind === "decided" && distJs !== undefined
        ? buildPreviewHtml({
            ...common,
            distJs,
            distCss: distUrl({
              base: deps.distBase,
              version: decision.version,
              file: "index.css",
            }),
            version: decision.version,
          })
        : buildPreviewHtml(common);
  }

  /** 設定ファイルを読み、読めたら `config` を替えて `configOk` を、読めなければ `config` を残して `configError` を送る。無ければ `config` を `{}` にする。読めなかったときは、前に読めた `libraries` を残す */
  async reloadConfig(): Promise<void> {
    const { log } = this.deps;
    const configuration = workspace.getConfiguration("mdmark", this.uri);
    const settings = readSettings((key) => configuration.get(key));
    const path = resolveConfigPath({
      configPath: settings.configPath,
      baseDir: baseDirOf(this.uri),
    });
    let load: Awaited<ReturnType<typeof loadConfig>>;
    try {
      load = await loadConfig({
        path,
        readFile: (target) => readFile(target, "utf8"),
      });
    } catch (error) {
      log.error(
        "設定ファイルを開けない",
        path,
        error instanceof Error ? error : String(error),
      );
      return;
    }
    if (load.kind === "missing") {
      this.config = {};
      this.rawLibraries = undefined;
      this.markConfigOk();
      return;
    }
    if (load.kind === "error") {
      log.warn("設定ファイルを読めない", path, load.line, load.message);
      this.configErrorLine = load.line;
      void this.post({ type: "configError", line: load.line });
      return;
    }
    const { libraries, ...rest } = load.config;
    this.rawLibraries = libraries;
    this.config =
      libraries === undefined
        ? rest
        : {
            ...rest,
            libraries: resolveLibraries({
              libraries,
              configDir: dirname(path),
              toUrl: (target) =>
                this.webviewPanel.webview
                  .asWebviewUri(Uri.file(target))
                  .toString(),
            }),
          };
    this.markConfigOk();
  }

  /** 設定ファイルを読み直し、`libraries` の origin の集まりが今の HTML の CSP に入れたものと違えば HTML を入れ直し（新しい配信元のモジュールを CSP が止めないため）、同じなら待たずに送る */
  async applyConfigChange(): Promise<void> {
    await this.reloadConfig();
    const next = libraryOrigins(this.rawLibraries);
    const same =
      next.length === this.cspLibraryOrigins.length &&
      next.every((origin) => this.cspLibraryOrigins.includes(origin));
    if (same) {
      this.renderNow();
      return;
    }
    await this.load();
  }

  /** 前が読めなかったときだけ `configOk` を送る */
  private markConfigOk(): void {
    if (this.configErrorLine !== undefined) {
      this.configErrorLine = undefined;
      void this.post({ type: "configOk" });
    }
  }

  /** 待ちを始め直し、`mdmark.preview.updateDelayMs` 後に送る */
  scheduleRender(): void {
    clearTimeout(this.timer);
    const configuration = workspace.getConfiguration("mdmark", this.uri);
    const settings = readSettings((key) => configuration.get(key));
    this.timer = setTimeout(() => {
      this.renderNow();
    }, settings.updateDelayMs);
  }

  /** 待ちを消し、パネルが見えていて `ready` を受けていれば、その時点の全文・`config`・配色で `render` を送る。見えていなければ送らない */
  renderNow(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.visible || !this.ready) {
      return;
    }
    const configuration = workspace.getConfiguration("mdmark", this.uri);
    const settings = readSettings((key) => configuration.get(key));
    void this.post({
      type: "render",
      markdown: this.document.getText(),
      config: this.config,
      theme: settings.theme,
    });
  }

  /** Webview のメッセージを `type` ごとに処理する */
  async handleMessage(message: WebviewMessage): Promise<void> {
    const { log } = this.deps;
    switch (message.type) {
      case "ready":
        this.ready = true;
        this.renderNow();
        if (this.configErrorLine !== undefined) {
          void this.post({ type: "configError", line: this.configErrorLine });
        }
        return;
      case "revealLine":
        this.revealEditorLine(message.line);
        return;
      case "openLink":
        await this.openLink(message.href);
        return;
      case "reload":
        await this.load();
        return;
      case "openConfig": {
        const configuration = workspace.getConfiguration("mdmark", this.uri);
        const settings = readSettings((key) => configuration.get(key));
        await openConfigFile({
          configPath: settings.configPath,
          baseDir: baseDirOf(this.uri),
          log,
        });
        return;
      }
      case "inspected":
        this.pendingInspects.get(message.id)?.(message.elements);
        this.pendingInspects.delete(message.id);
        return;
      case "loadFailed":
        log.warn(
          "配布物を読めない",
          message.reason,
          this.loaded?.version,
          this.loaded?.distJs,
        );
        return;
      case "rendered":
        return;
    }
  }

  /** エディタが見えているときだけ、行をエディタの先頭に置く（エディタを開き直さない） */
  private revealEditorLine(line: number): void {
    const configuration = workspace.getConfiguration("mdmark", this.uri);
    const settings = readSettings((key) => configuration.get(key));
    const editor = this.findEditor();
    if (!settings.scrollEditorWithPreview || editor === undefined) {
      return;
    }
    const visibleStart = editor.visibleRanges[0]?.start.line ?? 0;
    if (!this.scrollGuard.shouldReveal(line, visibleStart)) {
      return;
    }
    editor.revealRange(new Range(line, 0, line, 0), TextEditorRevealType.AtTop);
  }

  /** この Markdown を見せているエディタ */
  private findEditor() {
    return window.visibleTextEditors.find(
      (editor) => editor.document.uri.toString() === this.uri.toString(),
    );
  }

  /** 押したリンクを、外部の URL は既定のブラウザ、Markdown は元のエディタと同じ列、それ以外のファイルは `vscode.open` で開く */
  private async openLink(href: string): Promise<void> {
    const { log } = this.deps;
    const target = resolveLink({
      href,
      markdownDir: dirname(this.uri.fsPath),
    });
    if (target.kind === "none") {
      log.warn("開けないリンク", href);
      return;
    }
    if (target.kind === "external") {
      await env.openExternal(Uri.parse(target.url));
      return;
    }
    const uri = Uri.file(target.path);
    const exists = await stat(target.path).then(
      () => true,
      () => false,
    );
    if (!exists) {
      log.warn("リンク先が無い", href, target.path);
      return;
    }
    if (target.kind === "markdown") {
      const column = this.findEditor()?.viewColumn ?? ViewColumn.One;
      await window.showTextDocument(uri, { viewColumn: column });
      return;
    }
    await commands.executeCommand("vscode.open", uri);
  }

  /** エディタの見えている範囲が変わったとき、自分が動かした知らせでなければ、設定がオンのときに先頭の行を `scrollToLine` で送る */
  syncFromEditor(range: { start: number; end: number }): void {
    const configuration = workspace.getConfiguration("mdmark", this.uri);
    const settings = readSettings((key) => configuration.get(key));
    if (!settings.scrollPreviewWithEditor) {
      return;
    }
    if (!this.scrollGuard.takeVisibleRange(range)) {
      return;
    }
    void this.post({ type: "scrollToLine", line: range.start });
  }

  /** 新しい `id` で `inspect` を送り、`inspected` を受けたら解決する（テストのときだけ呼ばれる） */
  inspect(selector: string): Promise<InspectedElement[]> {
    const id = this.nextInspectId;
    this.nextInspectId += 1;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingInspects.delete(id);
        reject(new Error(`inspect の応答が来ない: ${selector}`));
      }, INSPECT_TIMEOUT_MS);
      this.pendingInspects.set(id, (elements) => {
        clearTimeout(timeout);
        resolve(elements);
      });
      void this.post({ type: "inspect", id, selector });
    });
  }

  /** Webview にメッセージを送る */
  private post(message: HostMessage): Thenable<boolean> {
    return this.webviewPanel.webview.postMessage(message);
  }
}
