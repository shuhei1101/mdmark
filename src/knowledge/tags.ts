import { normalizeWord } from "./dictionary.ts";
import type {
  MdmarkIndex,
  MdmarkIndexDoc,
  MdmarkIndexDocTag,
  MdmarkIndexTag,
} from "./index-shape.ts";

/** 近いタグの編集距離の上限 */
export const NEAR_TAG_MAX_DISTANCE = 2;

/** タグの語彙を、名前と別名から語彙のタグを引ける形にまとめたもの */
export type TagVocabulary = {
  /** 語彙のタグを語彙の並びで、同じ `name` は先の 1 つだけにしたもの */
  tags: MdmarkIndexTag[];
  /** 名前か別名から語彙のタグ。同じ文字の名前・別名が複数あるときは、語彙の並びで先のタグ */
  byWord: Map<string, MdmarkIndexTag>;
  /** タグの `name` から、`tags` の中の位置 */
  order: Map<string, number>;
};

/** `listTags` が返す語彙のタグ 1 つ */
export type TagListEntry = {
  /** タグの名前 */
  name: string;
  /** グループ。語彙に無いときは null */
  group: string | null;
  /** 説明。語彙に無いときは null */
  description: string | null;
  /** 別名。語彙に無いときは空 */
  aliases: string[];
  /** 振り替え先。やめたタグでないときは null */
  deprecated: string | null;
  /** そのタグが付いている文書の数 */
  docs: number;
};

/** `docs[].tags` の要素 1 つから、タグの名前と主題のタグかを返す */
export function readDocTag(tag: string | MdmarkIndexDocTag): {
  name: string;
  main: boolean;
} {
  if (typeof tag === "string") {
    return { name: tag, main: false };
  }
  return { name: tag.name, main: tag.main ?? false };
}

/** 索引の `tags` から語彙の引き表を作る。`tags` が無ければ `undefined` */
export function buildTagVocabulary(
  tags: MdmarkIndexTag[] | undefined,
): TagVocabulary | undefined {
  if (tags === undefined) {
    return undefined;
  }
  const vocabulary: TagVocabulary = {
    tags: [],
    byWord: new Map(),
    order: new Map(),
  };
  for (const tag of tags) {
    // 同じ `name` は先の 1 つだけを使う
    if (vocabulary.order.has(tag.name)) {
      continue;
    }
    vocabulary.order.set(tag.name, vocabulary.tags.length);
    vocabulary.tags.push(tag);
    for (const word of [tag.name, ...(tag.aliases ?? [])]) {
      if (!vocabulary.byWord.has(word)) {
        vocabulary.byWord.set(word, tag);
      }
    }
  }
  return vocabulary;
}

/** タグの名前を、語彙の `name` か `aliases` に同じ文字で当たるタグに引く */
export function resolveTag(options: {
  /** 語彙の引き表 */
  vocabulary: TagVocabulary;
  /** 引くタグの名前 */
  name: string;
}): MdmarkIndexTag | undefined {
  return options.vocabulary.byWord.get(options.name);
}

/** 2 つの文字列の、文字（コードポイント）の挿入・削除・置換の回数の最小を返す */
export function editDistance(a: string, b: string): number {
  const left = [...a];
  const right = [...b];
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  left.forEach((leftChar, row) => {
    const current = [row + 1];
    right.forEach((rightChar, column) => {
      current.push(
        Math.min(
          // 削除
          (previous[column + 1] ?? 0) + 1,
          // 挿入
          (current[column] ?? 0) + 1,
          // 置換（同じ文字なら 0 回）
          (previous[column] ?? 0) + (leftChar === rightChar ? 0 : 1),
        ),
      );
    });
    previous = current;
  });
  return previous[right.length] ?? 0;
}

/** 語彙に無いタグに、編集距離が上限以下で最も小さい語彙のタグの `name` を返す。無ければ `undefined` */
export function nearestTag(options: {
  /** 語彙の引き表 */
  vocabulary: TagVocabulary;
  /** 語彙に無いタグ */
  tag: string;
}): string | undefined {
  const { vocabulary, tag } = options;
  let nearest: { name: string; distance: number } | undefined;
  for (const candidate of vocabulary.tags) {
    // やめたタグは振り替え先を案内するため、候補にしない
    if (candidate.deprecated !== undefined) {
      continue;
    }
    for (const word of [candidate.name, ...(candidate.aliases ?? [])]) {
      const distance = editDistance(tag, word);
      // 同じ距離は先に見たタグを残すため、小さいときだけ入れ替える
      if (
        distance <= NEAR_TAG_MAX_DISTANCE &&
        (nearest === undefined || distance < nearest.distance)
      ) {
        nearest = { name: candidate.name, distance };
      }
    }
  }
  return nearest?.name;
}

/** 文書のタグを、語彙の `name` にそろえた名前の並びにする（同じタグは 1 つ、語彙に無いタグはそのまま） */
function resolvedNames(
  doc: MdmarkIndexDoc,
  vocabulary: TagVocabulary | undefined,
): string[] {
  const names = (doc.tags ?? []).map((tag) => {
    const { name } = readDocTag(tag);
    return vocabulary?.byWord.get(name)?.name ?? name;
  });
  return [...new Set(names)];
}

/** 文書の並びが持つタグごとに、そのタグを持つ文書の数を、件数の多い順・語彙の並び・名前の文字の順で返す */
export function countTags(options: {
  /** 数える文書 */
  docs: MdmarkIndexDoc[];
  /** 語彙の引き表 */
  vocabulary: TagVocabulary | undefined;
}): Array<{ name: string; count: number }> {
  const { docs, vocabulary } = options;
  const counts = new Map<string, number>();
  for (const doc of docs) {
    for (const name of resolvedNames(doc, vocabulary)) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
      if (a.count !== b.count) {
        return b.count - a.count;
      }
      const orderA = vocabulary?.order.get(a.name);
      const orderB = vocabulary?.order.get(b.name);
      if (orderA !== undefined && orderB !== undefined) {
        return orderA - orderB;
      }
      // 語彙にあるタグを、語彙に無いタグより先に並べる
      if (orderA !== undefined || orderB !== undefined) {
        return orderA === undefined ? 1 : -1;
      }
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
}

/** 索引のタグの語彙を、タグごとに付いている文書の数つきで語彙の並びに返す。語彙が無い索引では空 */
export function listTags(options: {
  /** 形に合う要素だけの索引 */
  index: MdmarkIndex;
  /** 名前・別名・説明のどれかに、`normalizeWord` で正規化した後に含まれる語 */
  query?: string;
}): TagListEntry[] {
  const { index, query } = options;
  const vocabulary = buildTagVocabulary(index.tags);
  if (vocabulary === undefined) {
    return [];
  }
  const docCounts = new Map<string, number>();
  for (const doc of index.docs) {
    for (const name of resolvedNames(doc, vocabulary)) {
      docCounts.set(name, (docCounts.get(name) ?? 0) + 1);
    }
  }
  const word = query === undefined ? undefined : normalizeWord(query);
  return vocabulary.tags
    .filter(
      (tag) =>
        word === undefined ||
        [tag.name, ...(tag.aliases ?? []), tag.description ?? ""].some(
          (field) => normalizeWord(field).includes(word),
        ),
    )
    .map((tag) => ({
      name: tag.name,
      group: tag.group ?? null,
      description: tag.description ?? null,
      aliases: tag.aliases ?? [],
      deprecated: tag.deprecated ?? null,
      docs: docCounts.get(tag.name) ?? 0,
    }));
}
