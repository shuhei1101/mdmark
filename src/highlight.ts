import type { LibraryEntry } from "./config.ts";

/** 色分けのライブラリの本体の対応表の名前 */
export const HIGHLIGHT_CORE = "hljs";

/** 情報文字列の言語から、色分けのライブラリの言語の名前を引く */
export const HIGHLIGHT_LANGUAGES: Readonly<Record<string, string>> = {
  ts: "typescript",
  typescript: "typescript",
  yaml: "yaml",
  yml: "yaml",
  python: "python",
  py: "python",
};

/** 対応表の言語のモジュールの名前 */
export function languageEntryName(language: string): string {
  return `${HIGHLIGHT_CORE}-${language}`;
}

/** 色分けのライブラリの本体が持つ関数のうち使うもの */
type HighlightCore = {
  registerLanguage: (name: string, language: unknown) => void;
  highlight: (code: string, options: { language: string }) => { value: string };
};

/** URL のモジュールを読む関数 */
type ImportModule = (url: string) => Promise<{ default?: unknown }>;

/** 既定のモジュールの読み方: 動的 `import()` */
const importByUrl: ImportModule = (url) => import(/* @vite-ignore */ url);

/** `span` の開きと閉じと、それ以外の文字に分ける */
const TAG_PATTERN = /(<span[^>]*>)|(<\/span>)|([^<]+)/g;

/** 色分けした HTML を行に分ける。行をまたいで開いている `span` は行末で閉じ、次の行の頭で開き直す */
export function splitHighlightedLines(html: string): string[] {
  const lines: string[] = [];
  const open: string[] = [];
  let line = "";
  for (const match of html.matchAll(TAG_PATTERN)) {
    const [, opening, closing, text] = match;
    if (opening !== undefined) {
      open.push(opening);
      line += opening;
    } else if (closing !== undefined) {
      open.pop();
      line += closing;
    } else if (text !== undefined) {
      const parts = text.split("\n");
      parts.forEach((part, index) => {
        // 改行ごとに行を閉じ、開いている span を次の行で開き直す
        if (index > 0) {
          lines.push(line + "</span>".repeat(open.length));
          line = open.join("");
        }
        line += part;
      });
    }
  }
  lines.push(line);
  return lines;
}

/** 要素の中の色分けできる言語のコードブロックを、色分けのライブラリと使う言語のモジュールだけを読んで色分けする。読めないモジュールの言語のコードブロックは色分けせずに残す */
export async function highlightCodeBlocks(options: {
  /** 描いた要素 */
  root: HTMLElement;
  /** 既定を当てた対応表 */
  libraries: Record<string, LibraryEntry>;
  /** 描いた文書がまだ今のものか */
  isCurrent: () => boolean;
  /** モジュールを読む関数（単体テストで差し替える） */
  importModule?: ImportModule;
}): Promise<void> {
  const { root, libraries, isCurrent, importModule = importByUrl } = options;
  // 色分けする言語ごとのコード要素
  const targets = new Map<string, HTMLElement[]>();
  for (const code of root.querySelectorAll<HTMLElement>(
    "pre > code[class^='language-']",
  )) {
    const info = code.className.replace(/^language-/, "").split(/\s+/)[0];
    const language = HIGHLIGHT_LANGUAGES[info ?? ""];
    if (language === undefined) {
      continue;
    }
    targets.set(language, [...(targets.get(language) ?? []), code]);
  }
  if (targets.size === 0) {
    return;
  }
  const coreEntry = libraries[HIGHLIGHT_CORE];
  if (!coreEntry) {
    return;
  }
  let core: HighlightCore;
  try {
    core = (await importModule(new URL(coreEntry.url, document.baseURI).href))
      .default as HighlightCore;
  } catch (error) {
    console.error("色分けのライブラリを読み込めない", coreEntry.url, error);
    return;
  }
  // 言語のモジュールは並べて読み、読めた言語だけを登録する
  const loaded = await Promise.all(
    [...targets.keys()].map(async (language) => {
      const entry = libraries[languageEntryName(language)];
      if (!entry) {
        return undefined;
      }
      try {
        const module = await importModule(
          new URL(entry.url, document.baseURI).href,
        );
        core.registerLanguage(language, module.default);
        return language;
      } catch (error) {
        console.error("色分けの言語を読み込めない", entry.url, error);
        return undefined;
      }
    }),
  );
  if (!isCurrent()) {
    return;
  }
  const started = performance.now();
  for (const language of loaded) {
    if (language === undefined) {
      continue;
    }
    for (const code of targets.get(language) ?? []) {
      highlightCode({ code, language, core });
    }
  }
  root.dataset.mdmarkHighlightMs = String(performance.now() - started);
}

/** コード要素 1 つを色分けする。行に分けた形は行ごとの `mdmark-code-text` だけを、分けない形は `code` の中身を書き換える */
function highlightCode(options: {
  code: HTMLElement;
  language: string;
  core: HighlightCore;
}): void {
  const { code, language, core } = options;
  const texts = [...code.querySelectorAll<HTMLElement>(".mdmark-code-text")];
  if (texts.length > 0) {
    const source = texts.map((text) => text.textContent ?? "").join("\n");
    const lines = splitHighlightedLines(
      core.highlight(source, { language }).value,
    );
    texts.forEach((text, index) => {
      text.innerHTML = lines[index] ?? "";
    });
    return;
  }
  const source = code.textContent ?? "";
  // 末尾の改行は色分けに渡さず、そのまま残す
  const body = source.endsWith("\n") ? source.slice(0, -1) : source;
  const tail = source.endsWith("\n") ? "\n" : "";
  code.innerHTML = core.highlight(body, { language }).value + tail;
}
