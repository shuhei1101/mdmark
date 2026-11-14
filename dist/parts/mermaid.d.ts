/** 図の枠の表示する枠に入れる、mermaid で描いた SVG の HTML と大きさを返却する。`printSvg` があれば印刷のための図として後ろに並べる */
export declare const renderMermaidDiagram: (options: {
    /** 今の配色で描いた SVG */
    svg: string;
    /** 暗い配色のときに、明るい配色のテーマでも描いた SVG */
    printSvg?: string | undefined;
    /** SVG を描いた幅（px） */
    width: number;
    /** SVG の高さ（px） */
    height: number;
}) => {
    html: string;
    width: number;
    height: number;
    tips: string;
};
