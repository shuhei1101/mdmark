import type { MdmarkAlias } from "../knowledge/aliases.ts";
import { escapeHtml } from "./escape.ts";
import { iconSvg } from "./icons.ts";

/** コマンドのコピーのボタンの状態 */
export type TermTipCopyState = "idle" | "copied" | "failed";

/** エイリアスの種類ごとの区分の見出し（`avoid` は「代わりの用語」の区分で出す） */
const ALIAS_HEADINGS = {
  term: "用語",
  doc: "文書",
  command: "コマンド",
  url: "URL",
  skill: "スキル",
  tool: "ツール",
  path: "パス",
} as const;

/** コピーのボタンの状態ごとの文言とアイコン（コードブロックのコピーと同じ） */
export const COMMAND_COPY_STATES = {
  idle: { text: "コピー", icon: "copy" },
  copied: { text: "コピーしました", icon: "check" },
  failed: { text: "コピーできませんでした", icon: "circle-alert" },
} as const;

/** コピーのボタンの中に配置する、状態のアイコンと文言の HTML を返却する */
export function renderTermTipCopy(state: TermTipCopyState): string {
  const { text, icon } = COMMAND_COPY_STATES[state];
  return `${iconSvg(icon)}${text}`;
}

/** URL を `a` のリンクにしてよいか（http・https だけ） */
function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** ツールチップの「関連文書」に並べる文書 1 つ */
export type TermTipDoc = {
  /** 文書のタイトル */
  title: string;
  /** 描く文書を基準にした相対パス */
  href: string;
  /** 索引の `description` */
  description?: string;
};

/** 区分 1 つ（見出しと中身）の HTML */
function renderSection(heading: string, body: string): string {
  return `<span class="mdmark-term-tip-section"><span class="mdmark-term-tip-heading">${heading}</span>${body}</span>`;
}

/** 本文の単語に破線の下線を付け、直後に「用語」の意味と「関連文書」のツールチップを配置する HTML を返却する。意味も関連文書も無ければ単語をそのまま返却する。`replacement` を指定すると、単語に波線のマーカーを引き、「代わりの用語」だけのツールチップを配置する（`meaning`・`docs` は使用しない） */
export function renderTermTip(props: {
  /** 下線を付ける本文の単語 */
  text: string;
  /** ツールチップの要素の `id` */
  id: string;
  /** 「用語」に出す意味。空なら「用語」の区分を出さない */
  meaning?: string;
  /** 「関連文書」に並べる文書。空なら「関連文書」の区分を出さない */
  docs?: TermTipDoc[];
  /** `text` がやめた言い方のときの代わりの用語。`meaning` が無ければ意味を配置しない */
  replacement?: { term: string; meaning?: string };
  /** `text` が一致したエイリアス。指定すると種類ごとの区分を出し、`meaning`・`docs` は使用しない */
  alias?: MdmarkAlias;
  /** コマンドのコピーのボタンの状態（`mount` が付けた状態）。省くと `idle` */
  copy?: TermTipCopyState;
  /** 単語の下に開いた外観にするか。ストーリーが下に開いた状態を出すために使用し、`render` は指定しない */
  below?: boolean;
}): string {
  const {
    text,
    id,
    meaning = "",
    docs = [],
    replacement,
    alias,
    copy = "idle",
    below = false,
  } = props;
  const word = escapeHtml(text);
  if (alias !== undefined && replacement === undefined) {
    return renderAliasTip({ text, id: props.id, alias, copy, below });
  }
  if (replacement === undefined && meaning === "" && docs.length === 0) {
    return word;
  }
  return renderWordTip({ word, id, meaning, docs, replacement, below });
}

/** 意味・関連文書か、代わりの用語のツールチップを単語の直後に配置した HTML を返却する */
function renderWordTip(options: {
  word: string;
  id: string;
  meaning: string;
  docs: TermTipDoc[];
  replacement: { term: string; meaning?: string } | undefined;
  below: boolean;
}): string {
  const { word, id, meaning, docs, replacement, below } = options;
  const tipId = escapeHtml(id);
  const meaningId = `${tipId}-meaning`;
  const sections =
    replacement === undefined
      ? renderTermSections({ meaning, docs, meaningId })
      : [renderReplacementSection(replacement)];
  const role =
    docs.length > 0 && replacement === undefined ? "group" : "tooltip";
  const label =
    role === "tooltip" ? "" : ` aria-label="${docsLabel({ word, meaning })}"`;
  const described = termDescribedBy({
    described: replacement !== undefined || meaning !== "",
    target: role === "group" ? meaningId : tipId,
  });
  const details = role === "group" ? ` aria-details="${tipId}"` : "";
  const termClass = replacement === undefined ? "" : " mdmark-term-avoided";
  const wrapClass = below ? "mdmark-term-wrap is-below" : "mdmark-term-wrap";
  return `<span class="${wrapClass}"><span class="mdmark-term${termClass}" tabindex="0"${described}${details}>${word}</span><span class="mdmark-term-tip" id="${tipId}" role="${role}"${label}>${sections.join("")}</span></span>`;
}

/** 関連文書を持つツールチップの名前を返却する */
function docsLabel(options: { word: string; meaning: string }): string {
  return `「${options.word}」の${options.meaning === "" ? "" : "用語と"}関連文書`;
}

/** 単語に付ける `aria-describedby` の属性を返却する（説明が無ければ空） */
function termDescribedBy(options: {
  described: boolean;
  target: string;
}): string {
  return options.described ? ` aria-describedby="${options.target}"` : "";
}

/** 「代わりの用語」の区分の HTML を返却する */
function renderReplacementSection(replacement: {
  term: string;
  meaning?: string;
}): string {
  const meaning =
    replacement.meaning === undefined
      ? ""
      : `<span class="mdmark-term-tip-meaning">${escapeHtml(replacement.meaning)}</span>`;
  return renderSection(
    "代わりの用語",
    `<span class="mdmark-term-tip-replacement">${escapeHtml(replacement.term)}</span>${meaning}`,
  );
}

/** 「用語」と「関連文書」の区分の HTML を返却する（空の区分は出さない） */
function renderTermSections(options: {
  meaning: string;
  docs: TermTipDoc[];
  meaningId: string;
}): string[] {
  const { meaning, docs, meaningId } = options;
  const sections: string[] = [];
  if (meaning !== "") {
    // 関連文書もあるときだけ、意味の要素に `id` を付けて単語の説明にする
    const idAttribute = docs.length > 0 ? ` id="${meaningId}"` : "";
    sections.push(
      renderSection(
        "用語",
        `<span class="mdmark-term-tip-meaning"${idAttribute}>${escapeHtml(meaning)}</span>`,
      ),
    );
  }
  if (docs.length > 0) {
    sections.push(renderDocsSection(docs));
  }
  return sections;
}

/** 「関連文書」の区分の HTML を返却する */
function renderDocsSection(docs: TermTipDoc[]): string {
  const items = docs
    .map((doc) => {
      const description = doc.description
        ? `<span class="mdmark-term-tip-doc-desc">${escapeHtml(doc.description)}</span>`
        : "";
      return `<span class="mdmark-term-tip-doc" role="listitem"><a href="${escapeHtml(doc.href)}">${escapeHtml(doc.title)}</a>${description}</span>`;
    })
    .join("");
  return renderSection(
    "関連文書",
    `<span class="mdmark-term-tip-docs" role="list">${items}</span>`,
  );
}

/** エイリアスの種類ごとの区分の中身（名前・説明・種類の項目）と、ツールチップの役割・単語に付ける属性を返却する */
function renderAliasTip(options: {
  text: string;
  id: string;
  alias: MdmarkAlias;
  copy: TermTipCopyState;
  below: boolean;
}): string {
  const { text, alias, copy, below } = options;
  const word = escapeHtml(text);
  const tipId = escapeHtml(options.id);
  const meaningId = `${tipId}-meaning`;
  const heading =
    ALIAS_HEADINGS[alias.alias_type as keyof typeof ALIAS_HEADINGS];
  const hasDescription =
    alias.description !== undefined && alias.description !== "";
  let body = `<span class="mdmark-term-tip-name">${escapeHtml(alias.name)}</span>`;
  if (hasDescription) {
    body += `<span class="mdmark-term-tip-meaning" id="${meaningId}">${escapeHtml(alias.description as string)}</span>`;
  }
  const kind = renderAliasKind({ alias, copy, word });
  body += kind.body;
  const role = kind.label === "" ? "tooltip" : "group";
  const labelAttribute = kind.label === "" ? "" : ` aria-label="${kind.label}"`;
  const described =
    role === "group"
      ? termDescribedBy({ described: hasDescription, target: meaningId })
      : ` aria-describedby="${tipId}"`;
  const details = role === "group" ? ` aria-details="${tipId}"` : "";
  const wrapClass = below ? "mdmark-term-wrap is-below" : "mdmark-term-wrap";
  return `<span class="${wrapClass}"><span class="mdmark-term" tabindex="0"${described}${details}>${word}</span><span class="mdmark-term-tip" id="${tipId}" role="${role}"${labelAttribute}>${renderSection(heading, body)}</span></span>`;
}

/** 種類の項目の HTML と、ツールチップの名前（中へ Tab で移れる `group` にするときだけ。それ以外は空）の組 */
type AliasKindPart = { body: string; label: string };

/** エイリアスの種類の項目（コマンド・リンク・値）の HTML と、ツールチップの名前を返却する */
function renderAliasKind(options: {
  alias: MdmarkAlias;
  copy: TermTipCopyState;
  word: string;
}): AliasKindPart {
  const { alias, copy, word } = options;
  // コマンドとリンクを持つツールチップは、中へ Tab で移れるよう `group` にする
  if (alias.alias_type === "command" && alias.command !== undefined) {
    return renderAliasCommand({
      command: alias.command,
      cwd: alias.cwd,
      copy,
      word,
    });
  }
  if (alias.alias_type === "url" && alias.url !== undefined) {
    return renderAliasUrl({ url: alias.url, word });
  }
  const value = aliasValueOf(alias);
  return {
    body:
      value === undefined
        ? ""
        : `<code class="mdmark-term-tip-code">${escapeHtml(value)}</code>`,
    label: "",
  };
}

/** コマンドの種類の項目（コマンド・コピーのボタン・実行場所・通知）を返却する */
function renderAliasCommand(options: {
  command: string;
  cwd: string | undefined;
  copy: TermTipCopyState;
  word: string;
}): AliasKindPart {
  const { command, cwd, copy, word } = options;
  const copyState = COMMAND_COPY_STATES[copy];
  let body = `<span class="mdmark-term-tip-command"><code>${escapeHtml(command)}</code><button class="mdmark-term-tip-copy" type="button" data-state="${copy}">${renderTermTipCopy(copy)}</button></span>`;
  if (cwd !== undefined && cwd !== "") {
    body += `<span class="mdmark-term-tip-fields"><span class="mdmark-term-tip-label">実行場所</span><span class="mdmark-term-tip-value">${escapeHtml(cwd)}</span></span>`;
  }
  const status = copy === "idle" ? "" : `コマンドを${copyState.text}`;
  body += `<span class="mdmark-visually-hidden mdmark-term-tip-status" role="status">${status}</span>`;
  return { body, label: `「${word}」のコマンド` };
}

/** URL の種類の項目を返却する。http・https 以外はリンクにしない */
function renderAliasUrl(options: { url: string; word: string }): AliasKindPart {
  const { url, word } = options;
  if (isHttpUrl(url)) {
    return {
      body: `<a class="mdmark-term-tip-link" href="${escapeHtml(url)}">${escapeHtml(url)}</a>`,
      label: `「${word}」の URL`,
    };
  }
  return {
    body: `<span class="mdmark-term-tip-link">${escapeHtml(url)}</span>`,
    label: "",
  };
}

/** スキル・ツール・パスの種類の値を返却する（それ以外の種類は `undefined`） */
function aliasValueOf(alias: MdmarkAlias): string | undefined {
  switch (alias.alias_type) {
    case "skill":
      return alias.skill;
    case "tool":
      return alias.tool;
    case "path":
      return alias.path;
    default:
      return undefined;
  }
}
