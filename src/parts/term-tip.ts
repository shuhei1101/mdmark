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

/** 本文の語に破線の下線を引き、直後に「用語」の意味と「関連文書」のツールチップを置く HTML を返す。意味も関連文書も無ければ語をそのまま返す */
export function renderTermTip(props: {
  /** 下線を引く本文の語 */
  text: string;
  /** ツールチップの要素の `id` */
  id: string;
  /** 「用語」に出す意味。空なら「用語」の区分を出さない */
  meaning?: string;
  /** 「関連文書」に並べる文書。空なら「関連文書」の区分を出さない */
  docs?: TermTipDoc[];
}): string {
  const { text, id, meaning = "", docs = [] } = props;
  const word = escapeHtml(text);
  if (meaning === "" && docs.length === 0) {
    return word;
  }
  const tipId = escapeHtml(id);
  const meaningId = `${tipId}-meaning`;
  const sections: string[] = [];
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
  const role = docs.length > 0 ? "group" : "tooltip";
  const label =
    docs.length === 0
      ? ""
      : ` aria-label="「${word}」の${meaning === "" ? "" : "用語と"}関連文書"`;
  const described =
    meaning === ""
      ? ""
      : ` aria-describedby="${docs.length > 0 ? meaningId : tipId}"`;
  const details = docs.length > 0 ? ` aria-details="${tipId}"` : "";
  return `<span class="mdmark-term-wrap"><span class="mdmark-term" tabindex="0"${described}${details}>${word}</span><span class="mdmark-term-tip" id="${tipId}" role="${role}"${label}>${sections.join("")}</span></span>`;
}
