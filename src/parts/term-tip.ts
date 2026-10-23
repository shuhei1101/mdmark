import { escapeHtml } from "./escape.ts";

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
  /** `text` がやめた言い方のときの代わりの用語 */
  replacement?: { term: string; meaning: string };
  /** 語の下に開いた見た目にするか。ストーリーが下に開いた状態を出すために使い、`render` は渡さない */
  below?: boolean;
}): string {
  const {
    text,
    id,
    meaning = "",
    docs = [],
    replacement,
    below = false,
  } = props;
  const word = escapeHtml(text);
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
        `<span class="mdmark-term-tip-replacement">${escapeHtml(replacement.term)}</span><span class="mdmark-term-tip-meaning">${escapeHtml(replacement.meaning)}</span>`,
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
