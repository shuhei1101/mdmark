/** 外部ライブラリのマーカーの場所に配置する、読み込み中のブロックの HTML を返却する */
export declare function renderEmbed(options: {
    /** マーカーの名前 */
    name: string;
    /** マーカーの引数の JSON のオブジェクト（既定 `{}`） */
    options?: Record<string, unknown>;
    /** マーカーの範囲から読み込んだ定義の番号。範囲で記載したマーカーだけが持つ */
    definition?: number;
}): string;
