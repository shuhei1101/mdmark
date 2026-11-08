import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { env, type TextDocument, Uri, window, workspace } from "vscode";
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
import { embedLocalLibraries } from "./embed.ts";
import { buildExportHtml, resolveExportPath } from "./html.ts";
import { writeFileAtomically } from "./write.ts";

/** 書き出した後に何をするか */
export type ExportMode = "export" | "browser" | "print";

/** 書き出した通知のボタン */
const OPEN_LABEL = "ブラウザで開く";

/** 設定を重ねて読み、相対パスの `libraries`・`html-scripts.url`・`mermaid.url` を `data:` の URL で埋め、`theme` の CSS を読み、`extensions` を束ねる。読めない設定ファイルは重ねずに残りで書き出す */
async function readExportConfig(options: {
  document: TextDocument;
  configPath: string;
  deps: ExtensionDeps;
}): Promise<{
  config: PreviewConfig;
  themeCss: string | undefined;
  extensions: string[];
}> {
  const { document, configPath, deps } = options;
  const { log } = deps;
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
    return { config: {}, themeCss: undefined, extensions: [] };
  }
  if (load.problem) {
    log.warn(
      "設定ファイルを読めないため、そのファイルを重ねずに書き出す",
      load.problem.path,
      load.problem.line ?? load.problem.settingKey ?? "",
      load.problem.message,
    );
  }
  const {
    libraries,
    "html-scripts": htmlScripts,
    mermaid,
    ...rest
  } = load.config;
  // 相対パスは重ねる前に絶対パスにしてある
  const embedded = await embedLocalLibraries({
    markdown: document.getText(),
    libraries,
    htmlScripts,
    mermaid,
    config: {
      features: Object.fromEntries(
        Object.entries(rest.features ?? {}).filter(
          (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
        ),
      ),
    },
    bundle: (paths) =>
      bundleExtensions({ paths, extensionPath: deps.context.extensionPath }),
  });
  for (const failure of embedded.failures) {
    log.warn("ライブラリをまとめられない", failure.path, failure.error);
  }
  const config: PreviewConfig = {
    ...rest,
    ...(embedded.libraries === undefined
      ? {}
      : { libraries: embedded.libraries }),
    ...(embedded.htmlScripts === undefined
      ? {}
      : { "html-scripts": embedded.htmlScripts }),
    ...(embedded.mermaid === undefined ? {} : { mermaid: embedded.mermaid }),
  };
  let themeCss: string | undefined;
  if (load.theme !== undefined) {
    try {
      themeCss = await readFile(load.theme, "utf8");
    } catch (error) {
      log.warn(
        "theme の CSS を読めない",
        load.theme,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
  const extensions: string[] = [];
  for (const result of await bundleExtensions({
    paths: load.extensions,
    extensionPath: deps.context.extensionPath,
  })) {
    if ("error" in result) {
      log.warn("拡張を束ねられない", result.path, result.error);
    } else {
      extensions.push(result.code);
    }
  }
  return { config, themeCss, extensions };
}

/** Markdown を HTML に書き出し、`mode` に合わせて知らせるか開く。書き出した HTML の `Uri` を返す。書き出せなかったときは `undefined` */
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
  // 読むバージョンを決める
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
      "HTML を書き出せませんでした。読む mdmark のバージョンを決められません。ネットワークにつながっているかを確かめてから、もう一度実行してください。",
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
  // 書き出す先を決め、全文（保存していない書き換えを含む）で HTML を組んで書く
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
  });
  try {
    await writeFileAtomically({ path, content: html });
  } catch (error) {
    const reason = error instanceof Error ? error : new Error(String(error));
    log.error("HTML を書き出せない", path, reason);
    await window.showErrorMessage(
      `HTML を書き出せませんでした: ${path}（${reason.message}）。設定 mdmark.export.outputDir を書き込めるフォルダに直してください。`,
    );
    return undefined;
  }
  log.info("HTML を書き出した", path, decision.version, mode);
  const uri = Uri.file(path);
  if (mode === "export") {
    // 通知の応答は待たずに返す
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
