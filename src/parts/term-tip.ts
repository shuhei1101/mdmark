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

/** コピーのボタンの中に置く、状態のアイコンと文言の HTML を返す */
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
  /** 文書の題 */
  title: string;
  /** 描く文書から見た相対パス */
  href: string;
  /** 索引の `description` */
  description?: string;
};

/** 区分 1 つ（見出しと中身）の HTML */
function renderSection(heading: string, body: string): string {
  return `<span class="mdmark-term-tip-section"><span class="mdmark-term-tip-heading">${heading}</span>${body}</span>`;
}

/** 本文の語に破線の下線を引き、直後に「用語」の意味と「関連文書」のツールチップを置く HTML を返す。意味も関連文書も無ければ語をそのまま返す。`replacement` を渡すと、語に波線のマーカーを引き、「代わりの用語」だけのツールチップを置く（`meaning`・`docs` は使わない） */
export function renderTermTip(props: {
  /** 下線を引く本文の語 */
  text: string;
  /** ツールチップの要素の `id` */
  id: string;
  /** 「用語」に出す意味。空なら「用語」の区分を出さない */
  meaning?: string;
  /** 「関連文書」に並べる文書。空なら「関連文書」の区分を出さない */
  docs?: TermTipDoc[];
  /** `text` がやめた言い方のときの代わりの用語。`meaning` が無ければ意味を置かない */
  replacement?: { term: string; meaning?: string };
  /** `text` が一致したエイリアス。渡すと種類ごとの区分を出し、`meaning`・`docs` は使わない */
  alias?: MdmarkAlias;
  /** コマンドのコピーのボタンの状態（`mount` が付けた状態）。省くと `idle` */
  copy?: TermTipCopyState;
  /** 語の下に開いた見た目にするか。ストーリーが下に開いた状態を出すために使い、`render` は渡さない */
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
  const tipId = escapeHtml(id);
  const meaningId = `${tipId}-meaning`;
  const sections: string[] = [];
  if (replacement !== undefined) {
    sections.push(
      renderSection(
        "代わりの用語",
        `<span class="mdmark-term-tip-replacement">${escapeHtml(replacement.term)}</span>${replacement.meaning === undefined ? "" : `<span class="mdmark-term-tip-meaning">${escapeHtml(replacement.meaning)}</span>`}`,
      ),
    );
  } else {
    if (meaning !== "") {
      // 関連文書もあるときだけ、意味の要素に `id` を付けて語の説明にする
      const idAttribute = docs.length > 0 ? ` id="${meaningId}"` : "";
      sections.push(
        renderSection(
          "用語",
          `<span class="mdmark-term-tip-meaning"${idAttribute}>${escapeHtml(meaning)}</span>`,
        ),
      );
    }
    if (docs.length > 0) {
      const items = docs
        .map((doc) => {
          const description = doc.description
            ? `<span class="mdmark-term-tip-doc-desc">${escapeHtml(doc.description)}</span>`
            : "";
          return `<span class="mdmark-term-tip-doc" role="listitem"><a href="${escapeHtml(doc.href)}">${escapeHtml(doc.title)}</a>${description}</span>`;
        })
        .join("");
      sections.push(
        renderSection(
          "関連文書",
          `<span class="mdmark-term-tip-docs" role="list">${items}</span>`,
        ),
      );
    }
  }
  const role =
    docs.length > 0 && replacement === undefined ? "group" : "tooltip";
  const label =
    role === "tooltip"
      ? ""
      : ` aria-label="「${word}」の${meaning === "" ? "" : "用語と"}関連文書"`;
  const described =
    replacement === undefined && meaning === ""
      ? ""
      : ` aria-describedby="${role === "group" ? meaningId : tipId}"`;
  const details = role === "group" ? ` aria-details="${tipId}"` : "";
  const termClass = replacement === undefined ? "" : " mdmark-term-avoided";
  const wrapClass = below ? "mdmark-term-wrap is-below" : "mdmark-term-wrap";
  return `<span class="${wrapClass}"><span class="mdmark-term${termClass}" tabindex="0"${described}${details}>${word}</span><span class="mdmark-term-tip" id="${tipId}" role="${role}"${label}>${sections.join("")}</span></span>`;
}

/** エイリアスの種類ごとの区分の中身（名前・説明・種類の項目）と、ツールチップの役割・語に付ける属性を返す */
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
  // コマンドとリンクを持つツールチップは、中へ Tab で移れるよう `group` にする
  let label = "";
  if (alias.alias_type === "command" && alias.command !== undefined) {
    const copyState = COMMAND_COPY_STATES[copy];
    body += `<span class="mdmark-term-tip-command"><code>${escapeHtml(alias.command)}</code><button class="mdmark-term-tip-copy" type="button" data-state="${copy}">${renderTermTipCopy(copy)}</button></span>`;
    if (alias.cwd !== undefined && alias.cwd !== "") {
      body += `<span class="mdmark-term-tip-fields"><span class="mdmark-term-tip-label">実行場所</span><span class="mdmark-term-tip-value">${escapeHtml(alias.cwd)}</span></span>`;
    }
    const status = copy === "idle" ? "" : `コマンドを${copyState.text}`;
    body += `<span class="mdmark-visually-hidden mdmark-term-tip-status" role="status">${status}</span>`;
    label = `「${word}」のコマンド`;
  } else if (alias.alias_type === "url" && alias.url !== undefined) {
    if (isHttpUrl(alias.url)) {
      body += `<a class="mdmark-term-tip-link" href="${escapeHtml(alias.url)}">${escapeHtml(alias.url)}</a>`;
      label = `「${word}」の URL`;
    } else {
      body += `<span class="mdmark-term-tip-link">${escapeHtml(alias.url)}</span>`;
    }
  } else {
    const value =
      alias.alias_type === "skill"
        ? alias.skill
        : alias.alias_type === "tool"
          ? alias.tool
          : alias.alias_type === "path"
            ? alias.path
            : undefined;
    if (value !== undefined) {
      body += `<code class="mdmark-term-tip-code">${escapeHtml(value)}</code>`;
    }
  }
  const role = label === "" ? "tooltip" : "group";
  const labelAttribute = label === "" ? "" : ` aria-label="${label}"`;
  const described =
    role === "group"
      ? hasDescription
        ? ` aria-describedby="${meaningId}"`
        : ""
      : ` aria-describedby="${tipId}"`;
  const details = role === "group" ? ` aria-details="${tipId}"` : "";
  const wrapClass = below ? "mdmark-term-wrap is-below" : "mdmark-term-wrap";
  return `<span class="${wrapClass}"><span class="mdmark-term" tabindex="0"${described}${details}>${word}</span><span class="mdmark-term-tip" id="${tipId}" role="${role}"${labelAttribute}>${renderSection(heading, body)}</span></span>`;
}
