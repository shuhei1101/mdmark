import type { DiffRevision } from "../diff/source.ts";
/** リビジョンの説明: 日時（日本時間）に `label` と `author` を続ける */
export declare function describeRevision(revision: DiffRevision): string;
/** 部品設計『リビジョンの選択』: 前と後のリビジョンを選ぶ 2 つの欄と、削除した行と追加した行の数の文の HTML を返す。前の欄では一番新しいリビジョンを、後の欄では前に選んだもの以前のリビジョンを選べなくする */
export declare function renderRevisionPicker(options: {
    /** 新しい順のリビジョン */
    revisions: DiffRevision[];
    /** 前の欄で選んだリビジョンの `id` */
    before: string;
    /** 後の欄で選んだリビジョンの `id` */
    after: string;
    /** 削除した行と追加した行の数。省くと数の文を空にする */
    counts?: {
        del: number;
        add: number;
    };
    /** `label` と `select` を結ぶ `id` の頭 */
    idPrefix: string;
}): string;
