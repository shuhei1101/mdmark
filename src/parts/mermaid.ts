/** 図の枠の表示する枠に入れる、mermaid で描いた SVG の HTML と大きさを返す。`printSvg` があれば印刷のための図として後ろに並べる */
export const renderMermaidDiagram = (options: {
  /** 今の配色で描いた SVG */
  svg: string;
  /** 暗い配色のときに、明るい配色のテーマでも描いた SVG */
  printSvg?: string | undefined;
  /** SVG を描いた幅（px） */
  width: number;
  /** SVG の高さ（px） */
  height: number;
}): { html: string; width: number; height: number; tips: string } => {
  const { svg, printSvg, width, height } = options;
  const html =
    printSvg === undefined
      ? `<div class="mdmark-mermaid">${svg}</div>`
      : `<div class="mdmark-mermaid mdmark-mermaid-has-print">${svg}<div class="mdmark-mermaid-print" aria-hidden="true">${printSvg}</div></div>`;
  return { html, width, height, tips: "" };
};
