import type { MdmarkIndexDocTag, MdmarkIndexTag } from "./index-shape.ts";
/** 近いタグの編集距離の上限 */
export declare const NEAR_TAG_MAX_DISTANCE = 2;
/** タグの語彙を、名前と別名から語彙のタグを引ける形にまとめたもの */
export type TagVocabulary = {
    /** 語彙のタグを語彙の並びで、同じ `name` は先の 1 つだけにしたもの */
    tags: MdmarkIndexTag[];
    /** 名前か別名から語彙のタグ。同じ文字の名前・別名が複数あるときは、語彙の並びで先のタグ */
    byWord: Map<string, MdmarkIndexTag>;
    /** タグの `name` から、`tags` の中の位置 */
    order: Map<string, number>;
};
/** `docs[].tags` の要素 1 つから、タグの名前と主題のタグかを返す */
export declare function readDocTag(tag: string | MdmarkIndexDocTag): {
    name: string;
    main: boolean;
};
/** 索引の `tags` から語彙の引き表を作る。`tags` が無ければ `undefined` */
export declare function buildTagVocabulary(tags: MdmarkIndexTag[] | undefined): TagVocabulary | undefined;
/** タグの名前を、語彙の `name` か `aliases` に同じ文字で当たるタグに引く */
export declare function resolveTag(options: {
    /** 語彙の引き表 */
    vocabulary: TagVocabulary;
    /** 引くタグの名前 */
    name: string;
}): MdmarkIndexTag | undefined;
/** 2 つの文字列の、文字（コードポイント）の挿入・削除・置換の回数の最小を返す */
export declare function editDistance(a: string, b: string): number;
/** 語彙に無いタグに、編集距離が上限以下で最も小さい語彙のタグの `name` を返す。無ければ `undefined` */
export declare function nearestTag(options: {
    /** 語彙の引き表 */
    vocabulary: TagVocabulary;
    /** 語彙に無いタグ */
    tag: string;
}): string | undefined;
