/** 注意書きの種類 */
export type CalloutKind = "note" | "tip" | "important" | "warning" | "caution";
/** 注意書きの種類（引用の 1 行目に記載できる。知らない種類は `note`） */
export declare const CALLOUT_KINDS: readonly CalloutKind[];
/** 注意書きの HTML を返却する */
export declare function renderCallout(options: {
    /** 種類 */
    kind: CalloutKind;
    /** 折り畳みか */
    collapsed?: boolean;
    /** 折り畳みが開いているか */
    open?: boolean;
    /** タイトルの行内の HTML（エスケープ済み）。指定すると種類の名前はスクリーンリーダーだけにする */
    title?: string | undefined;
    /** 本文の HTML（`SLOT_MARKER` を指定できる） */
    body: string;
}): string;
