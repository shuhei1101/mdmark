import type { SideTocMode } from "../config.ts";
/** 右側の目次に並べる見出し 1 つ */
export type SideTocHeading = {
    /** 見出しのレベル */
    level: 1 | 2 | 3;
    /** 見出しの ID */
    id: string;
    /** 目次に出す見出しの文字 */
    text: string;
    /** 比較元から変わったセクションか。`true` なら項目と右端の線に変更のマーカーを付ける */
    changed?: boolean;
};
/** 右側の目次の HTML を返却する。深いレベルの見出しは直前の浅いレベルの入れ子にし、右端の線を見出しの数だけ並べる */
export declare function renderSideToc(options: {
    /** 文書の頭からの h1・h2・h3 */
    headings: SideTocHeading[];
    /** 出し方（既定 `hover`） */
    mode?: SideTocMode;
    /** すべて展開・すべて折りたたむのボタンを配置するか（既定 `true`） */
    sections?: boolean;
    /** 目次を出しているか（既定 `false`） */
    open?: boolean;
    /** ピン止めしているか（既定 `false`） */
    pinned?: boolean;
    /** 今いるセクションの見出しの ID */
    current?: string;
    /** パネルの ID */
    panelId?: string;
}): string;
