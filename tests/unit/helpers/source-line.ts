/** HTML から元の行番号の属性 `data-source-line` を取り除く（開始タグのどこに付いていても取り除く）。元の行番号以外の出力を比べるテストが使う */
export function stripSourceLine(html: string): string {
  return html.replace(/ data-source-line="\d+"/g, "");
}
