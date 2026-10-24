import type { MdmarkIndex, MdmarkIndexDoc } from "./index-shape.ts";
import type { MdmarkReferences } from "./references.ts";
import {
  buildTagVocabulary,
  nearestTag,
  readDocTag,
  resolveTag,
  type TagVocabulary,
} from "./tags.ts";

/** `findDocs` の戻り値 */
export type FindDocsResult = {
  /** 当たった文書。主題のタグが当たる文書を上にし、同じ順位の中は索引の `docs` の並び */
  docs: MdmarkIndexDoc[];
  /** 語彙を持つ索引で、`tags`・`anyTags` に渡したタグのうち語彙に当たらないもの（渡した順、重なりを除く）と近いタグの `name`。語彙の無い索引では空 */
  unknownTags: Array<{ tag: string; nearest: string | undefined }>;
};

/** 文書の題・別名・概要のどれかに、大文字と小文字を区別せず語が含まれるか */
function matchesText(doc: MdmarkIndexDoc, text: string): boolean {
  const word = text.toLowerCase();
  return [doc.title, ...(doc.aliases ?? []), doc.description ?? ""].some(
    (field) => field.toLowerCase().includes(word),
  );
}

/** タグの名前を、語彙があれば語彙の `name` にそろえる（語彙に当たらなければそのまま） */
function normalizeTag(
  name: string,
  vocabulary: TagVocabulary | undefined,
): string {
  return vocabulary === undefined
    ? name
    : (resolveTag({ vocabulary, name })?.name ?? name);
}

/** 文書のタグを、語彙の `name` にそろえた名前と主題のタグかの並びにする */
function docTags(
  doc: MdmarkIndexDoc,
  vocabulary: TagVocabulary | undefined,
): Array<{ name: string; main: boolean }> {
  return (doc.tags ?? []).map((tag) => {
    const { name, main } = readDocTag(tag);
    return { name: normalizeTag(name, vocabulary), main };
  });
}

/** 索引の文書を、題・別名・概要の部分一致、タグの AND / OR、関係する文書で絞る。渡した条件を全て満たす文書を、主題のタグが当たる文書を上にして返す */
export function findDocs(options: {
  /** 索引 */
  index: MdmarkIndex;
  /** 参照の表。`relatedTo` を渡すときに要る */
  references?: MdmarkReferences;
  /** 題・別名・概要に含まれる語 */
  text?: string;
  /** 全てを持つ文書に絞るタグ */
  tags?: string[];
  /** どれかを持つ文書に絞るタグ */
  anyTags?: string[];
  /** 関係を引く文書の ID */
  relatedTo?: string;
}): FindDocsResult {
  const { index, references, text, tags, anyTags, relatedTo } = options;
  const vocabulary = buildTagVocabulary(index.tags);
  // 語彙に無いタグは、拒まず近いタグと一緒に返す
  const unknownTags: FindDocsResult["unknownTags"] = [];
  if (vocabulary !== undefined) {
    for (const tag of new Set([...(tags ?? []), ...(anyTags ?? [])])) {
      if (resolveTag({ vocabulary, name: tag }) === undefined) {
        unknownTags.push({ tag, nearest: nearestTag({ vocabulary, tag }) });
      }
    }
  }
  const wantedAll = (tags ?? []).map((tag) => normalizeTag(tag, vocabulary));
  const wantedAny = (anyTags ?? []).map((tag) => normalizeTag(tag, vocabulary));
  let docs = index.docs;
  if (text !== undefined) {
    docs = docs.filter((doc) => matchesText(doc, text));
  }
  if (tags !== undefined) {
    docs = docs.filter((doc) => {
      const names = docTags(doc, vocabulary).map((tag) => tag.name);
      return wantedAll.every((tag) => names.includes(tag));
    });
  }
  if (anyTags !== undefined) {
    docs = docs.filter((doc) => {
      const names = docTags(doc, vocabulary).map((tag) => tag.name);
      return wantedAny.some((tag) => names.includes(tag));
    });
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
  // 渡したタグが主題のタグに当たる文書を上に並べる（同じ順位の中は索引の並びのまま）
  const wanted = new Set([...wantedAll, ...wantedAny]);
  const isMain = (doc: MdmarkIndexDoc): boolean =>
    docTags(doc, vocabulary).some((tag) => tag.main && wanted.has(tag.name));
  const ranked = docs.map((doc) => ({ doc, main: isMain(doc) }));
  ranked.sort((a, b) => Number(b.main) - Number(a.main));
  return { docs: ranked.map(({ doc }) => doc), unknownTags };
}
