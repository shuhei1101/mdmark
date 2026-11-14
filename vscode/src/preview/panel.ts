import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
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
import { formatCheckIssue } from "../../../src/cli/issues.ts";
import { displayConfigPath } from "../../../src/config-files.ts";
import type { MdmarkAlias } from "../../../src/knowledge/aliases.ts";
import type { ConfigProblem, PreviewConfig } from "../config.ts";
import {
  applyColorTheme,
  applyPreviewTheme,
  isFile,
  libraryOrigins,
  loadConfig,
  resolveConfigPath,
  resolveHtmlScripts,
  resolveLibraries,
  resolveMermaid,
  resolveSyntax,
} from "../config.ts";
import { openConfigFile } from "../config-file.ts";
import { type ExtensionDeps, LAST_VERSION_KEY } from "../deps.ts";
import { bundleExtensions } from "../extensions-bundle.ts";
import type {
  AxeViolation,
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
import { assetCandidates } from "./assets.ts";
import { buildCsp, buildPreviewHtml, createNonce, distUrl } from "./html.ts";
import { readIncludes } from "./includes.ts";
import { resolveLink } from "./links.ts";
import { EditorScrollGuard } from "./scroll-guard.ts";

/** `inspect` の結果を待つ上限（ミリ秒） */
const INSPECT_TIMEOUT_MS = 5000;

/** 1 つの Markdown のパネル。読み込むバージョンと設定を決めて HTML を入れ、Webview とメッセージをやり取りし、再描画の待ちを 1 つだけ持つ */
export class PreviewPanel {
  /** VS Code のパネル */
  private readonly webviewPanel: WebviewPanel;
  /** 対象の Markdown（差分のパネルは変更後の文書） */
  private readonly document: TextDocument;
  /** 差分のパネルの変更前の文書。通常のパネルでは `undefined` */
  private readonly original: TextDocument | undefined;
  /** 設定のスコープ・設定ファイルの基準のフォルダを決める URI。差分の変更後が `git:` などの URI でも、ファイルの場所で決める */
  private readonly fileUri: Uri;
  /** 拡張機能の共通の依存 */
  private readonly deps: ExtensionDeps;
  /** 最後に読み込めた設定（`libraries` は Webview で読み込める URL に修正した値。読み込めたことが無ければ `{}`） */
  private config: PreviewConfig = {};
  /** 取り込みの根のフォルダ（設定ファイルのフォルダ。無ければ Markdown のフォルダ） */
  private includeRoot: string | undefined;
  /** 前回の `render` で読み込んだ取り込む文書のパス */
  private includePaths: string[] = [];
  /** `config` の `libraries` の URL を修正する前の値（CSP に入れる origin の元） */
  private rawLibraries: Record<string, unknown> | undefined;
  /** 設定ファイルに書き込んだままの `html-scripts`（CSP の origin に使用する） */
  private rawHtmlScripts: Record<string, unknown> | undefined;
  /** 設定ファイルに書き込んだままの `mermaid`（CSP の origin に使用する） */
  private rawMermaid: Record<string, unknown> | undefined;
  /** 設定ファイルに書き込んだままの `syntax`（CSP の origin に使用する） */
  private rawSyntax: Record<string, unknown> | undefined;
  /** 今の HTML の CSP に入れた `libraries` の origin（`load` が記載する）。設定ファイルを再読み込みした後の origin と比べ、違えば HTML をもう一度入れる */
  private cspLibraryOrigins: string[] = [];
  /** 設定ファイルを読み込めていないときの読み込めない行 */
  private configProblem: ConfigProblem | undefined;
  /** 前に使用した設定があるか */
  private configUsed = false;
  /** 最も近い設定ファイル */
  private nearest: string | undefined;
  /** 見張るファイル（重ねた設定ファイル・`theme`・`extensions`・`aliases` の行の `paths` に該当した YAML・記載した `mdmark.configPath` のファイル・端末の設定） */
  watched: string[] = [];
  /** 最後に使用したエイリアス。読み込めない設定ファイルがあるときは前に使用したエイリアスを残す */
  private aliases: MdmarkAlias[] | undefined;
  /** 再読み込みした `theme`・`extensions` の絶対パス */
  private wanted: { theme?: string | undefined; extensions: string[] } = {
    extensions: [],
  };
  /** 今の HTML に入れた `theme` と、`extensions` の絶対パス・中身の SHA-256・まとめて記載したファイル */
  private embedded: {
    theme?: string | undefined;
    extensions: Array<{ path: string; hash: string; file?: string }>;
  } = { extensions: [] };
  /** `theme` の CSS を替えた回数（`link` の URL に付けて再読み込みさせる） */
  private themeVersion = 0;
  /** 見張るファイルが変わったときに呼ぶ関数 */
  private readonly onWatchedChange: () => void;
  /** 再描画するまでの待ち。待つ間に変更が来たらもう一度始める */
  private timer: NodeJS.Timeout | undefined;
  /** 今の HTML の Webview から `ready` を受けたか */
  private ready = false;
  /** 読み込むたびに増やす番号。リロードが重なったとき、後の呼び出しだけが HTML を入れる */
  private loadToken = 0;
  /** エディタを動かした直後の通知を捨てる判定 */
  private readonly scrollGuard = new EditorScrollGuard();
  /** `inspect` の `id` → 結果を指定する関数（テストのときだけ使用する） */
  private readonly pendingInspects = new Map<
    number,
    (elements: InspectedElement[]) => void
  >();
  /** 最後に HTML へ入れた配布物のバージョンと `index.js` の URL（決められなかったときは `undefined`） */
  private loaded: { version: string; distJs: string } | undefined;
  /** `axe` の `id` → 結果を指定する関数（テストのときだけ使用する） */
  private readonly pendingAudits = new Map<
    number,
    (violations: AxeViolation[]) => void
  >();
  /** 次の `inspect`・`axe` の `id` */
  private nextInspectId = 1;
  /** 設定ファイルの `assets.root` の絶対パス（無ければ `undefined`） */
  private assetsRoot: string | undefined;
  /** `localResourceRoots` に加えたフォルダ（もう一度入れるときに削除する） */
  private addedResourceRoots: string[] = [];

  constructor(options: {
    webviewPanel: WebviewPanel;
    document: TextDocument;
    original?: TextDocument;
    deps: ExtensionDeps;
    onWatchedChange?: () => void;
  }) {
    this.webviewPanel = options.webviewPanel;
    this.onWatchedChange = options.onWatchedChange ?? (() => {});
    this.document = options.document;
    this.original = options.original;
    this.fileUri =
      options.original === undefined
        ? options.document.uri
        : Uri.file(options.document.uri.fsPath);
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

  /** 対象の Markdown の URI（差分のパネルは変更後の URI） */
  get uri(): Uri {
    return this.document.uri;
  }

  /** 設定のスコープ・設定ファイルの基準のフォルダを決める URI */
  get scope(): Uri {
    return this.fileUri;
  }

  /** 今の列のまま表に出す */
  reveal(): void {
    this.webviewPanel.reveal();
  }

  /** 読み込むバージョンと設定をもう一度決め、Webview に HTML を入れる（開くときとリロードのとき） */
  async load(): Promise<void> {
    this.loadToken += 1;
    const token = this.loadToken;
    const { deps } = this;
    const { log } = deps;
    const configuration = workspace.getConfiguration("mdmark", this.fileUri);
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
    const extensions = await this.prepareExtensions();
    if (token !== this.loadToken) {
      return;
    }
    this.ready = false;
    this.cspLibraryOrigins = libraryOrigins({
      libraries: this.rawLibraries,
      htmlScripts: this.rawHtmlScripts,
      mermaid: this.rawMermaid,
      syntax: this.rawSyntax,
    });
    const webview = this.webviewPanel.webview;
    this.updateResourceRoots();
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
      themeHref:
        this.wanted.theme === undefined
          ? undefined
          : webview.asWebviewUri(Uri.file(this.wanted.theme)).toString(),
      extensions: extensions.map((file) =>
        webview.asWebviewUri(Uri.file(file)).toString(),
      ),
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

  /** 設定を重ねて読み込み、読み込めない設定ファイルが無ければ `config` を替えて（前に帯を出していたら）`configOk` を、あれば前に使用した `config` を残して `configError` を送信する。読み込めない設定ファイルが無いかを返却する */
  async reloadConfig(): Promise<boolean> {
    const { log } = this.deps;
    const configuration = workspace.getConfiguration("mdmark", this.fileUri);
    const settings = readSettings((key) => configuration.get(key));
    const baseDir = baseDirOf(this.fileUri);
    let load: Awaited<ReturnType<typeof loadConfig>>;
    try {
      load = await loadConfig({
        cwd: dirname(this.fileUri.fsPath),
        configPath: settings.configPath,
        baseDir,
        purpose: "preview",
        env: process.env,
        home: homedir(),
        readFile: (target) => readFile(target, "utf8"),
        isFile,
      });
    } catch (error) {
      log.error(
        "設定ファイルを開けない",
        settings.configPath,
        error instanceof Error ? error : String(error),
      );
      return false;
    }
    const watched = [
      ...load.files,
      ...(load.theme === undefined ? [] : [load.theme]),
      ...load.extensions,
      ...load.aliasFiles,
      ...(settings.configPath === ""
        ? []
        : [resolveConfigPath({ configPath: settings.configPath, baseDir })]),
    ];
    if (load.problem) {
      watched.push(load.problem.path);
    }
    const changed =
      watched.length !== this.watched.length ||
      watched.some((path, index) => path !== this.watched[index]);
    this.watched = watched;
    if (changed) {
      this.onWatchedChange();
    }
    this.nearest = load.nearest;
    this.includeRoot =
      load.nearest === undefined
        ? dirname(this.fileUri.fsPath)
        : dirname(load.nearest);
    if (load.problem && this.configUsed) {
      this.reportProblem(load.problem);
      return false;
    }
    const {
      libraries,
      "html-scripts": htmlScripts,
      mermaid,
      syntax,
      ...rest
    } = load.config;
    this.rawLibraries = libraries;
    this.rawHtmlScripts = htmlScripts;
    this.rawMermaid = mermaid;
    this.rawSyntax = syntax;
    this.assetsRoot = load.assetsRoot;
    this.wanted = { theme: load.theme, extensions: load.extensions };
    // 相対パスは重ねる前に絶対パスにしてある
    const configDir = dirname(this.fileUri.fsPath);
    const toUrl = (target: string) =>
      this.webviewPanel.webview.asWebviewUri(Uri.file(target)).toString();
    this.config = {
      ...rest,
      ...(libraries === undefined
        ? {}
        : { libraries: resolveLibraries({ libraries, configDir, toUrl }) }),
      ...(htmlScripts === undefined
        ? {}
        : {
            "html-scripts": resolveHtmlScripts({
              htmlScripts,
              configDir,
              toUrl,
            }),
          }),
      ...(mermaid === undefined
        ? {}
        : { mermaid: resolveMermaid({ mermaid, configDir, toUrl }) }),
      ...(syntax === undefined
        ? {}
        : { syntax: resolveSyntax({ syntax, configDir, toUrl }) }),
    };
    this.aliases = load.aliases;
    for (const issue of load.aliasIssues) {
      log.warn(formatCheckIssue(issue));
    }
    this.configUsed = true;
    if (load.problem) {
      this.reportProblem(load.problem);
      return false;
    }
    this.markConfigOk();
    return true;
  }

  /** 読み込めない設定ファイルを帯に出す */
  private reportProblem(problem: ConfigProblem): void {
    this.deps.log.warn(
      "設定ファイルを読み込めない",
      problem.path,
      problem.line ?? problem.settingKey ?? "",
      problem.message,
    );
    this.configProblem = problem;
    void this.post(this.configErrorMessage(problem));
  }

  /** 帯に出す `configError` */
  private configErrorMessage(problem: ConfigProblem): HostMessage {
    const path = displayConfigPath({
      path: problem.path,
      base: baseDirOf(this.fileUri),
      home: homedir(),
    });
    return problem.line === undefined
      ? {
          type: "configError",
          path,
          settingKey: problem.settingKey ?? "",
        }
      : { type: "configError", path, line: problem.line };
  }

  /** `extensions` のパスの並びかその中身が今の HTML と違えばもう一度まとめ、まとめたファイルの並びを返却する（まとめられない拡張は飛ばす） */
  private async prepareExtensions(): Promise<string[]> {
    const { log, context } = this.deps;
    const hashed = await Promise.all(
      this.wanted.extensions.map(async (path) => ({
        path,
        hash: await readFile(path).then(
          (bytes) => createHash("sha256").update(bytes).digest("hex"),
          () => "",
        ),
      })),
    );
    const same =
      hashed.length === this.embedded.extensions.length &&
      hashed.every(
        (entry, index) =>
          entry.path === this.embedded.extensions[index]?.path &&
          entry.hash === this.embedded.extensions[index]?.hash,
      );
    if (!same) {
      const directory = join(context.globalStorageUri.fsPath, "extensions");
      const results = await bundleExtensions({
        paths: hashed.map((entry) => entry.path),
        extensionPath: context.extensionPath,
      });
      const extensions: Array<{ path: string; hash: string; file?: string }> =
        [];
      for (const [index, result] of results.entries()) {
        const hash = hashed[index]?.hash ?? "";
        if ("error" in result) {
          log.warn("拡張をまとめられない", result.path, result.error);
          extensions.push({ path: result.path, hash });
          continue;
        }
        const name = createHash("sha256").update(result.code).digest("hex");
        const file = join(directory, `${name}.mjs`);
        await mkdir(directory, { recursive: true });
        await writeFile(file, result.code);
        extensions.push({ path: result.path, hash, file });
      }
      this.embedded = { ...this.embedded, extensions };
    }
    this.embedded = { ...this.embedded, theme: this.wanted.theme };
    return this.embedded.extensions.flatMap((entry) =>
      entry.file === undefined ? [] : [entry.file],
    );
  }

  /** 設定を再読み込みして変更を適用する。`libraries` の origin の集まり・`extensions`・`theme` のパスが変われば HTML をもう一度入れ、`theme` のファイルだけが変われば `theme` を送信し、それ以外は待たずに送信する。読み込めない設定ファイルがあれば送信しない */
  async applyConfigChange(path?: string): Promise<void> {
    if (!(await this.reloadConfig())) {
      return;
    }
    const next = libraryOrigins({
      libraries: this.rawLibraries,
      htmlScripts: this.rawHtmlScripts,
      mermaid: this.rawMermaid,
      syntax: this.rawSyntax,
    });
    const sameOrigins =
      next.length === this.cspLibraryOrigins.length &&
      next.every((origin) => this.cspLibraryOrigins.includes(origin));
    const sameExtensions =
      this.wanted.extensions.length === this.embedded.extensions.length &&
      this.wanted.extensions.every(
        (entry, index) => entry === this.embedded.extensions[index]?.path,
      ) &&
      (path === undefined || !this.wanted.extensions.includes(path));
    const sameTheme = this.wanted.theme === this.embedded.theme;
    if (!sameOrigins || !sameExtensions || !sameTheme) {
      await this.load();
      return;
    }
    if (path !== undefined && path === this.wanted.theme) {
      this.themeVersion += 1;
      const href = this.webviewPanel.webview
        .asWebviewUri(Uri.file(path))
        .toString();
      void this.post({ type: "theme", href: `${href}?v=${this.themeVersion}` });
      return;
    }
    this.renderNow();
  }

  /** 前に帯を出していたときだけ `configOk` を送信する */
  private markConfigOk(): void {
    if (this.configProblem !== undefined) {
      this.configProblem = undefined;
      void this.post({ type: "configOk" });
    }
  }

  /** 待ちをもう一度始め、`mdmark.preview.updateDelayMs` 後に送信する */
  scheduleRender(): void {
    clearTimeout(this.timer);
    const configuration = workspace.getConfiguration("mdmark", this.fileUri);
    const settings = readSettings((key) => configuration.get(key));
    this.timer = setTimeout(() => {
      this.renderNow();
    }, settings.updateDelayMs);
  }

  /** 待ちを削除し、パネルが見えていて `ready` を受けていれば、その時点の全文・`config` を `mdmark.colorTheme` で上書きした設定・配色で `render` を送信する。見えていなければ送信しない */
  renderNow(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.visible || !this.ready) {
      return;
    }
    void this.postRender();
  }

  /** 前回の `render` で読み込んだ取り込む文書に `path` が入っているか */
  readsInclude(path: string): boolean {
    return this.includePaths.includes(path);
  }

  /** 取り込む文書を再読み込みし、全文・設定・配色と一緒に `render` を送信する */
  private async postRender(): Promise<void> {
    const configuration = workspace.getConfiguration("mdmark", this.fileUri);
    const settings = readSettings((key) => configuration.get(key));
    const markdown = this.document.getText();
    const { includes, paths } = await readIncludes({
      markdownPath: this.fileUri.fsPath,
      markdown,
      root: this.includeRoot ?? dirname(this.fileUri.fsPath),
      readFile: async (target) => {
        try {
          return new TextDecoder().decode(
            await workspace.fs.readFile(Uri.file(target)),
          );
        } catch {
          return undefined;
        }
      },
    });
    this.includePaths = paths;
    void this.post({
      type: "render",
      markdown,
      includes,
      ...(this.aliases === undefined ? {} : { aliases: this.aliases }),
      ...(this.original === undefined
        ? {}
        : { previous: this.original.getText() }),
      config: applyPreviewTheme({
        config: applyColorTheme({
          config: this.config,
          colorTheme: settings.colorTheme,
        }),
        theme: settings.theme,
      }),
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
        if (this.configProblem !== undefined) {
          void this.post(this.configErrorMessage(this.configProblem));
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
        const configuration = workspace.getConfiguration(
          "mdmark",
          this.fileUri,
        );
        const settings = readSettings((key) => configuration.get(key));
        await openConfigFile({
          path: this.configProblem?.path ?? this.nearest,
          cwd: dirname(this.fileUri.fsPath),
          configPath: settings.configPath,
          baseDir: baseDirOf(this.fileUri),
          log,
        });
        return;
      }
      case "resolveAssets": {
        const urls: Record<string, string | null> = {};
        for (const path of message.paths) {
          const found = await this.findAsset(path);
          urls[path] =
            found === undefined
              ? null
              : `${this.webviewPanel.webview.asWebviewUri(Uri.file(found.file)).toString()}${found.suffix}`;
        }
        void this.post({ type: "assetsResolved", id: message.id, urls });
        return;
      }
      case "openAsset": {
        const found = await this.findAsset(message.path);
        if (found === undefined) {
          log.warn("開けないファイル", message.path);
          return;
        }
        await env.openExternal(Uri.file(found.file));
        return;
      }
      case "inspected":
        this.pendingInspects.get(message.id)?.(message.elements);
        this.pendingInspects.delete(message.id);
        return;
      case "axed":
        this.pendingAudits.get(message.id)?.(message.violations);
        this.pendingAudits.delete(message.id);
        return;
      case "loadFailed":
        if (message.reason === "diffUnsupported") {
          log.warn("差分の色分けに対応しないバージョン", this.loaded?.version);
          return;
        }
        log.warn(
          "配布物を読み込めない",
          message.reason,
          this.loaded?.version,
          this.loaded?.distJs,
        );
        return;
      case "rendered":
        return;
    }
  }

  /** `localResourceRoots` に `assets.root` のフォルダ・`theme` のファイルのフォルダ・まとめた拡張のフォルダを加えてもう一度入れる（前に加えたものは削除する） */
  private updateResourceRoots(): void {
    const webview = this.webviewPanel.webview;
    const base = (webview.options.localResourceRoots ?? []).filter(
      (root) => !this.addedResourceRoots.includes(root.fsPath),
    );
    const wanted = [
      ...(this.assetsRoot === undefined ? [] : [this.assetsRoot]),
      ...(this.wanted.theme === undefined ? [] : [dirname(this.wanted.theme)]),
      join(this.deps.context.globalStorageUri.fsPath, "extensions"),
    ];
    const added = [...new Set(wanted)].filter(
      (path) => !base.some((root) => root.fsPath === path),
    );
    this.addedResourceRoots = added;
    webview.options = {
      ...webview.options,
      localResourceRoots: [...base, ...added.map((path) => Uri.file(path))],
    };
  }

  /** 記載したパスを Markdown のフォルダ、次に `assets.root` で探し、ワークスペースの中にあった最初のファイルと、URL の後ろに戻すクエリとフラグメントを返却する */
  private async findAsset(
    path: string,
  ): Promise<{ file: string; suffix: string } | undefined> {
    const workspaceDirs = [
      baseDirOf(this.fileUri),
      ...(workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath),
    ];
    const { files, suffix } = assetCandidates(path, {
      docDir: dirname(this.uri.fsPath),
      assetsRoot: this.assetsRoot,
      workspaceDirs,
    });
    for (const file of files) {
      try {
        await workspace.fs.stat(Uri.file(file));
        return { file, suffix };
      } catch {
        // 無いときは次の候補を探す
      }
    }
    return undefined;
  }

  /** エディタが見えているときだけ、行をエディタの先頭に配置する（エディタをもう一度開かない） */
  private revealEditorLine(line: number): void {
    const configuration = workspace.getConfiguration("mdmark", this.fileUri);
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

  /** エディタの見えている範囲が変わったとき、自分が動かした通知でなければ、設定がオンのときに先頭の行を `scrollToLine` で送信する */
  syncFromEditor(range: { start: number; end: number }): void {
    const configuration = workspace.getConfiguration("mdmark", this.fileUri);
    const settings = readSettings((key) => configuration.get(key));
    if (!settings.scrollPreviewWithEditor) {
      return;
    }
    if (!this.scrollGuard.takeVisibleRange(range)) {
      return;
    }
    void this.post({ type: "scrollToLine", line: range.start });
  }

  /** 新しい `id` で `inspect` を送信し、`inspected` を受けたら解決する（テストのときだけ呼ばれる）。`play` は `inspect` に指定する */
  inspect(selector: string, play = false): Promise<InspectedElement[]> {
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
      void this.post({ type: "inspect", id, selector, play });
    });
  }

  /** `inspect` と同じ番号の列の新しい `id` で `axe` を送信し、`axed` を受けたら解決する（テストのときだけ呼ばれる） */
  audit(): Promise<AxeViolation[]> {
    const id = this.nextInspectId;
    this.nextInspectId += 1;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingAudits.delete(id);
        reject(new Error("axe の応答が来ない"));
      }, INSPECT_TIMEOUT_MS);
      this.pendingAudits.set(id, (violations) => {
        clearTimeout(timeout);
        resolve(violations);
      });
      void this.post({ type: "axe", id });
    });
  }

  /** Webview にメッセージを送信する */
  private post(message: HostMessage): Thenable<boolean> {
    return this.webviewPanel.webview.postMessage(message);
  }
}
