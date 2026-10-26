import { normalizeWord } from "./dictionary.ts";
import {
  type MdmarkIndex,
  type MdmarkIndexDoc,
  type MdmarkRelationType,
  readRelated,
} from "./index-shape.ts";
import type { MdmarkReferences } from "./references.ts";
import {
  buildTagVocabulary,
  nearestTag,
  readDocTag,
  resolveTag,
  type TagVocabulary,
} from "./tags.ts";

/** `MdmarkRelationType` から、相手の側から見た関係の名前 */
export const INVERSE_RELATION_TYPES = {
  requires: "required_by",
  references: "referenced_by",
  replaces: "replaced_by",
  part_of: "has_part",
  change_together: "change_together",
} as const satisfies Record<MdmarkRelationType, string>;

/** `findDocs` の `relatedTo` の文書から見た、当たった文書との関係 1 つ */
export type DocRelation = {
  /** `outgoing` は `relatedTo` の文書から当たった文書へ、`incoming` は当たった文書から `relatedTo` の文書へ */
  direction: "outgoing" | "incoming";
  /** `outgoing` は記載した `type`、`incoming` は逆向きの名前。本文のリンクと別名の出現だけで当たったものと、索引の文字列の要素は `null` */
  type:
    | MdmarkRelationType
    | (typeof INVERSE_RELATION_TYPES)[MdmarkRelationType]
    | null;
  /** 索引の関連に記載した `when`。`type` が `null` なら `null` */
  when: string | null;
};

/** `findDocs` の戻り値 */
export type FindDocsResult = {
  /** 当たった文書。主題のタグが当たる文書を上にし、同じ順位の中は索引の `docs` の並び */
  docs: MdmarkIndexDoc[];
  /** 当たった文書の `id` から、`relatedTo` の文書との関係の並び（`outgoing` → `incoming` の順）。`relatedTo` を渡さないときは空 */
  relations: Record<string, DocRelation[]>;
  /** 語彙を持つ索引で、`tags`・`anyTags` に渡したタグのうち語彙に当たらないもの（渡した順、重なりを除く）と近いタグの `name`。語彙の無い索引では空 */
  unknownTags: Array<{ tag: string; nearest: string | undefined }>;
};

/** 文書の題・別名・概要のどれかに、`normalizeWord` で正規化した後に語が含まれるか */
function matchesText(doc: MdmarkIndexDoc, text: string): boolean {
  const word = normalizeWord(text);
  return [doc.title, ...(doc.aliases ?? []), doc.description ?? ""].some(
    (field) => normalizeWord(field).includes(word),
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

/** 文書 `from` の関連のうち、`to` の文書を相手にする要素を `readRelated` でそろえて返す */
function relatedOf(
  from: MdmarkIndexDoc | undefined,
  to: string,
): ReturnType<typeof readRelated>[] {
  return (from?.related ?? [])
    .map(readRelated)
    .filter((related) => related.to === to);
}

/** `relatedTo` の文書から見た、当たった文書 1 つとの関係を `outgoing` → `incoming` の順で返す。索引の関連が無い向きは、参照の表でその向きに参照しているときだけ `type` と `when` が `null` の関係を 1 つ置く */
function relationsOf(options: {
  doc: MdmarkIndexDoc;
  source: MdmarkIndexDoc | undefined;
  sourceId: string;
  backlinks: Record<string, string[]>;
}): DocRelation[] {
  const { doc, source, sourceId, backlinks } = options;
  const outgoing: DocRelation[] = relatedOf(source, doc.id).map(
    ({ type, when }) => ({ direction: "outgoing", type, when }),
  );
  const incoming: DocRelation[] = relatedOf(doc, sourceId).map(
    ({ type, when }) => ({
      direction: "incoming",
      type: type === null ? null : INVERSE_RELATION_TYPES[type],
      when,
    }),
  );
  if (outgoing.length === 0 && (backlinks[doc.id] ?? []).includes(sourceId)) {
    outgoing.push({ direction: "outgoing", type: null, when: null });
  }
  if (incoming.length === 0 && (backlinks[sourceId] ?? []).includes(doc.id)) {
    incoming.push({ direction: "incoming", type: null, when: null });
  }
  return [...outgoing, ...incoming];
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
  // 空の配列は、省いたときと同じくタグで絞らない
  if (anyTags !== undefined && anyTags.length > 0) {
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
  const found = ranked.map(({ doc }) => doc);
  // 関係は、`relatedTo` の文書から見た向きごとに引く
  const relations: Record<string, DocRelation[]> = {};
  if (relatedTo !== undefined) {
    const source = index.docs.find((doc) => doc.id === relatedTo);
    for (const doc of found) {
      relations[doc.id] = relationsOf({
        doc,
        source,
        sourceId: relatedTo,
        backlinks: references?.backlinks ?? {},
      });
    }
  }
  return { docs: found, relations, unknownTags };
}
