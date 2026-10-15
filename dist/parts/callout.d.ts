/** 注意書きの種類 */
export type CalloutKind = "note" | "tip" | "important" | "warning" | "caution";
/** 注意書きの種類（引用の 1 行目に書ける。知らない種類は `note`） */
export declare const CALLOUT_KINDS: readonly CalloutKind[];
/** 注意書きの HTML を返す */
export declare function renderCallout(options: {
    /** 種類 */
    kind: CalloutKind;
    /** 折り畳みか */
    collapsed?: boolean;
    /** 折り畳みが開いているか */
    open?: boolean;
    /** 本文の HTML（`SLOT_MARKER` を渡せる） */
    body: string;
}): string;
