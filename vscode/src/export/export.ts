import { readFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { env, type TextDocument, Uri, window, workspace } from "vscode";
import type { PreviewConfig } from "../config.ts";
import { loadConfig, resolveConfigPath, resolveLibraries } from "../config.ts";
import { type ExtensionDeps, LAST_VERSION_KEY } from "../deps.ts";
import { distUrl } from "../preview/html.ts";
import { readSettings } from "../settings.ts";
import {
  decideVersion,
  fetchLatestVersion,
  TAGS_TIMEOUT_MS,
} from "../version.ts";
import { baseDirOf } from "../workspace.ts";
import { buildExportHtml, resolveExportPath } from "./html.ts";
import { writeFileAtomically } from "./write.ts";

/** 書き出した後に何をするか */
export type ExportMode = "export" | "browser" | "print";

/** 書き出した通知のボタン */
const OPEN_LABEL = "ブラウザで開く";

/** 設定ファイルを読み、`libraries` の相対パスを `file:` の URL に直す。読めない・無いときは設定なし */
async function readExportConfig(options: {
  document: TextDocument;
  configPath: string;
  deps: ExtensionDeps;
}): Promise<PreviewConfig> {
  const { document, configPath, deps } = options;
  const path = resolveConfigPath({
    configPath,
    baseDir: baseDirOf(document.uri),
  });
  const load = await loadConfig({
    path,
    readFile: (target) => readFile(target, "utf8"),
  });
  if (load.kind === "error") {
    deps.log.warn(
      "設定ファイルを読めないため設定なしで書き出す",
      path,
      load.line,
      load.message,
    );
    return {};
  }
  if (load.kind === "missing") {
    return {};
  }
  const { libraries, ...rest } = load.config;
  if (libraries === undefined) {
    return rest;
  }
  return {
    ...rest,
    libraries: resolveLibraries({
      libraries,
      configDir: dirname(path),
      toUrl: (target) => pathToFileURL(target).href,
    }),
  };
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
  const config = await readExportConfig({
    document,
    configPath: settings.configPath,
    deps,
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
