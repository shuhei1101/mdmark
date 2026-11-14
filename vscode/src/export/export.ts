import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { env, type TextDocument, Uri, window, workspace } from "vscode";
import { formatCheckIssue } from "../../../src/cli/issues.ts";
import type { MdmarkAlias } from "../../../src/knowledge/aliases.ts";
import type { PreviewConfig } from "../config.ts";
import { applyColorTheme, isFile, loadConfig } from "../config.ts";
import { type ExtensionDeps, LAST_VERSION_KEY } from "../deps.ts";
import { bundleExtensions } from "../extensions-bundle.ts";
import { distUrl } from "../preview/html.ts";
import { readSettings } from "../settings.ts";
import {
  decideVersion,
  fetchLatestVersion,
  TAGS_TIMEOUT_MS,
} from "../version.ts";
import { baseDirOf } from "../workspace.ts";
import { embedLocalLibraries, embedLocalSyntax } from "./embed.ts";
import { buildExportHtml, resolveExportPath } from "./html.ts";
import { writeFileAtomically } from "./write.ts";

/** 書き出した後に何をするか */
export type ExportMode = "export" | "browser" | "print";

/** 書き出した通知のボタン */
const OPEN_LABEL = "ブラウザで開く";

/** 重ねた設定の `features` のうち値が真偽値のものだけを返却する（`MdmarkConfig` の `features` の形） */
const features = (value: Record<string, unknown> | undefined) =>
  Object.fromEntries(
    Object.entries(value ?? {}).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
    ),
  );

/** 設定を重ねて読み込み、読み込めないファイルと用語の問題をログに出す。開けない設定ファイルでは `undefined` */
async function loadExportConfig(options: {
  document: TextDocument;
  configPath: string;
  log: ExtensionDeps["log"];
}): Promise<Awaited<ReturnType<typeof loadConfig>> | undefined> {
  const { document, configPath, log } = options;
  const markdownPath = document.uri.fsPath;
  let load: Awaited<ReturnType<typeof loadConfig>>;
  try {
    load = await loadConfig({
      cwd: dirname(markdownPath),
      configPath,
      baseDir: baseDirOf(document.uri),
      purpose: "export",
      env: process.env,
      home: homedir(),
      readFile: (target) => readFile(target, "utf8"),
      isFile,
    });
  } catch (error) {
    // 開けない設定ファイルでは、設定なしで書き出す
    log.error(
      "設定ファイルを開けない",
      configPath,
      error instanceof Error ? error : String(error),
    );
    return undefined;
  }
  if (load.problem) {
    log.warn(
      "設定ファイルを読み込めないため、そのファイルを重ねずに書き出す",
      load.problem.path,
      load.problem.line ?? load.problem.settingKey ?? "",
      load.problem.message,
    );
  }
  for (const issue of load.aliasIssues) {
    log.warn(formatCheckIssue(issue));
  }
  return load;
}

/** 相対パスの `libraries`・`html-scripts.url`・`mermaid.url` を `data:` の URL で埋め、相対パスの `syntax.url` の本体と使用する言語のモジュールを import map で割り当てた設定を返却する */
async function embedExportLibraries(options: {
  document: TextDocument;
  loaded: Record<string, unknown> & PreviewConfig;
  deps: ExtensionDeps;
}): Promise<{ config: PreviewConfig; importMap: Record<string, string> }> {
  const { document, loaded, deps } = options;
  const {
    libraries,
    "html-scripts": htmlScripts,
    mermaid,
    syntax,
    ...rest
  } = loaded;
  const bundle = (paths: string[]) =>
    bundleExtensions({ paths, extensionPath: deps.context.extensionPath });
  // 相対パスは重ねる前に絶対パスにしてある
  const embedded = await embedLocalLibraries({
    markdown: document.getText(),
    libraries,
    htmlScripts,
    mermaid,
    config: { features: features(rest.features) },
    bundle,
  });
  const embeddedSyntax = await embedLocalSyntax({
    markdown: document.getText(),
    syntax,
    config: { features: features(rest.features) },
    bundle,
  });
  for (const failure of [...embedded.failures, ...embeddedSyntax.failures]) {
    deps.log.warn("ライブラリをまとめられない", failure.path, failure.error);
  }
  const config: PreviewConfig = {
    ...rest,
    ...definedEntry("libraries", embedded.libraries),
    ...definedEntry("html-scripts", embedded.htmlScripts),
    ...definedEntry("mermaid", embedded.mermaid),
    ...definedEntry("syntax", embeddedSyntax.syntax),
  };
  return { config, importMap: embeddedSyntax.imports };
}

/** 値が `undefined` でなければ `{ [key]: value }`、`undefined` なら空のオブジェクト */
const definedEntry = <K extends string, V>(
  key: K,
  value: V | undefined,
): Partial<Record<K, V>> =>
  value === undefined ? {} : ({ [key]: value } as Record<K, V>);

/** `theme` の CSS を読み込む。無いか読み込めなければ `undefined` */
async function readThemeCss(
  theme: string | undefined,
  log: ExtensionDeps["log"],
): Promise<string | undefined> {
  if (theme === undefined) {
    return undefined;
  }
  try {
    return await readFile(theme, "utf8");
  } catch (error) {
    log.warn(
      "theme の CSS を読み込めない",
      theme,
      error instanceof Error ? error.message : String(error),
    );
    return undefined;
  }
}

/** `extensions` をまとめる。まとめられない拡張はログに出して除く */
async function bundleExportExtensions(
  paths: string[],
  deps: ExtensionDeps,
): Promise<string[]> {
  const extensions: string[] = [];
  for (const result of await bundleExtensions({
    paths,
    extensionPath: deps.context.extensionPath,
  })) {
    if ("error" in result) {
      deps.log.warn("拡張をまとめられない", result.path, result.error);
    } else {
      extensions.push(result.code);
    }
  }
  return extensions;
}

/** 設定を重ねて読み込み、相対パスの `libraries`・`html-scripts.url`・`mermaid.url` を `data:` の URL で埋め、相対パスの `syntax.url` の本体と使用する言語のモジュールを import map で割り当て、`theme` の CSS を読み込み、`extensions` をまとめる。読み込めない設定ファイルは重ねずに残りで書き出す */
async function readExportConfig(options: {
  document: TextDocument;
  configPath: string;
  deps: ExtensionDeps;
}): Promise<{
  config: PreviewConfig;
  themeCss: string | undefined;
  extensions: string[];
  importMap: Record<string, string>;
  aliases: MdmarkAlias[] | undefined;
}> {
  const { document, configPath, deps } = options;
  const load = await loadExportConfig({ document, configPath, log: deps.log });
  if (load === undefined) {
    return {
      config: {},
      themeCss: undefined,
      extensions: [],
      importMap: {},
      aliases: undefined,
    };
  }
  const { config, importMap } = await embedExportLibraries({
    document,
    loaded: load.config,
    deps,
  });
  return {
    config,
    themeCss: await readThemeCss(load.theme, deps.log),
    extensions: await bundleExportExtensions(load.extensions, deps),
    importMap,
    aliases: load.aliases,
  };
}

/** Markdown を HTML に書き出し、`mode` に合わせて通知するか開く。書き出した HTML の `Uri` を返却する。書き出せなかったときは `undefined` */
export async function exportMarkdown(options: {
  /** 書き出す Markdown */
  document: TextDocument;
  /** 書き出した後に何をするか */
  mode: ExportMode;
  /** 拡張機能の共通の依存 */
  deps: ExtensionDeps;
}): Promise<Uri | undefined> {
  const { document, mode, deps } = options;
  const { log } = deps;
  const configuration = workspace.getConfiguration("mdmark", document.uri);
  const settings = readSettings((key) => configuration.get(key));
  // 読み込むバージョンを決める
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
  if (decision.kind === "undecidable") {
    await window.showErrorMessage(
      "HTML を書き出せませんでした。読み込む mdmark のバージョンを決められません。ネットワークにつながっているかを確認してから、もう一度実行してください。",
    );
    return undefined;
  }
  if (decision.fetched) {
    await deps.context.globalState.update(LAST_VERSION_KEY, decision.version);
  }
  const exported = await readExportConfig({
    document,
    configPath: settings.configPath,
    deps,
  });
  const config = applyColorTheme({
    config: exported.config,
    colorTheme: settings.colorTheme,
  });
  // 書き出す先を決め、全文（保存していない書き換えを含む）で HTML を組んで記載する
  const markdownPath = document.uri.fsPath;
  const path = resolveExportPath({
    markdownPath,
    outputDir: settings.outputDir,
    workspaceDir: baseDirOf(document.uri),
  });
  const html = buildExportHtml({
    markdown: document.getText(),
    config,
    title: basename(markdownPath),
    distJs: distUrl({
      base: deps.distBase,
      version: decision.version,
      file: "index.js",
    }),
    distCss: distUrl({
      base: deps.distBase,
      version: decision.version,
      file: "index.css",
    }),
    baseHref: `${pathToFileURL(dirname(markdownPath)).href}/`,
    print: mode === "print",
    themeCss: exported.themeCss,
    extensions: exported.extensions,
    importMap: exported.importMap,
    aliases: exported.aliases,
  });
  try {
    await writeFileAtomically({ path, content: html });
  } catch (error) {
    const reason = error instanceof Error ? error : new Error(String(error));
    log.error("HTML を書き出せない", path, reason);
    await window.showErrorMessage(
      `HTML を書き出せませんでした: ${path}（${reason.message}）。設定 mdmark.export.outputDir を書き込めるフォルダに修正してください。`,
    );
    return undefined;
  }
  log.info("HTML を書き出した", path, decision.version, mode);
  const uri = Uri.file(path);
  if (mode === "export") {
    // 通知の応答は待たずに返却する
    void window
      .showInformationMessage(`HTML を書き出しました: ${path}`, OPEN_LABEL)
      .then((choice) => {
        if (choice === OPEN_LABEL) {
          return env.openExternal(uri);
        }
        return undefined;
      });
  } else {
    await env.openExternal(uri);
  }
  return uri;
}
