import type { MdmarkIndex, MdmarkIndexDoc } from "./index-shape.ts";
import type { MdmarkReferences } from "./references.ts";

/** 文書の題・別名・概要のどれかに、大文字と小文字を区別せず語が含まれるか */
function matchesText(doc: MdmarkIndexDoc, text: string): boolean {
  const word = text.toLowerCase();
  return [doc.title, ...(doc.aliases ?? []), doc.description ?? ""].some(
    (field) => field.toLowerCase().includes(word),
  );
}

/** 索引の文書を、題・別名・概要の部分一致、タグ、関係する文書で絞る。渡した条件を全て満たす文書を、索引の `docs` の並びで返す */
export function findDocs(options: {
  /** 索引 */
  index: MdmarkIndex;
  /** 参照の表。`relatedTo` を渡すときに要る */
  references?: MdmarkReferences;
  /** 題・別名・概要に含まれる語 */
  text?: string;
  /** 全てを持つ文書に絞るタグ */
  tags?: string[];
  /** 関係を引く文書の ID */
  relatedTo?: string;
}): MdmarkIndexDoc[] {
  const { index, references, text, tags, relatedTo } = options;
  let docs = index.docs;
  if (text !== undefined) {
    docs = docs.filter((doc) => matchesText(doc, text));
  }
  if (tags !== undefined) {
    docs = docs.filter((doc) =>
      tags.every((tag) => (doc.tags ?? []).includes(tag)),
    );
  }
  if (relatedTo !== undefined) {
    const backlinks = references?.backlinks ?? {};
    // この文書を参照している文書と、この文書が参照している文書
    docs = docs.filter(
      (doc) =>
        doc.id !== relatedTo &&
        ((backlinks[relatedTo] ?? []).includes(doc.id) ||
          (backlinks[doc.id] ?? []).includes(relatedTo)),
    );
  }
  return docs;
}
