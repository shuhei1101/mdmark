# parts

parts の設計書

## 目次

<!-- table: data -->

| ページ | 概要 |
| --- | --- |
| [back-to-top.ts](./back-to-top.ts.yaml) | ライブラリ本体 / 部品 / back-to-top.ts |
| [backlinks.ts](./backlinks.ts.yaml) | ライブラリ本体 / 索引と用語 / backlinks.ts |
| [badge.ts](./badge.ts.yaml) | ライブラリ本体 / 部品 / badge.ts |
| [callout.ts](./callout.ts.yaml) | ライブラリ本体 / 記法 / callout.ts |
| [card-grid.ts](./card-grid.ts.yaml) | ライブラリ本体 / 部品 / card-grid.ts |
| [card.ts](./card.ts.yaml) | ライブラリ本体 / 部品 / card.ts |
| [chart.ts](./chart.ts.yaml) | ライブラリ本体 / 図 / chart.ts |
| [code-block.ts](./code-block.ts.yaml) | ライブラリ本体 / 部品 / code-block.ts |
| [collapsible.ts](./collapsible.ts.yaml) | ライブラリ本体 / 部品 / collapsible.ts |
| [colors.ts](./colors.ts.yaml) | ライブラリ本体 / 部品 / colors.ts |
| [comment.ts](./comment.ts.yaml) | ライブラリ本体 / ビューとコメント / comment.ts |
| [diagram.ts](./diagram.ts.yaml) | ライブラリ本体 / 図 / diagram.ts |
| [diff-blocks.ts](./diff-blocks.ts.yaml) | ライブラリ本体 / 差分 / diff-blocks.ts |
| [diff-html.ts](./diff-html.ts.yaml) | ライブラリ本体 / 差分 / diff-html.ts |
| [diff-lines.ts](./diff-lines.ts.yaml) | ライブラリ本体 / 差分 / diff-lines.ts |
| [diff-message.ts](./diff-message.ts.yaml) | ライブラリ本体 / 差分 / diff-message.ts |
| [diff-minimap.ts](./diff-minimap.ts.yaml) | ライブラリ本体 / 差分 / diff-minimap.ts |
| [diff-toggle.ts](./diff-toggle.ts.yaml) | ライブラリ本体 / 差分 / diff-toggle.ts |
| [doc-list.ts](./doc-list.ts.yaml) | ライブラリ本体 / 部品 / doc-list.ts |
| [embed.ts](./embed.ts.yaml) | ライブラリ本体 / 部品 / embed.ts |
| [er.ts](./er.ts.yaml) | ライブラリ本体 / 図 / er.ts |
| [escape.ts](./escape.ts.yaml) | ライブラリ本体 / 部品 / escape.ts |
| [figure.ts](./figure.ts.yaml) | ライブラリ本体 / 部品 / figure.ts |
| [footnote.ts](./footnote.ts.yaml) | ライブラリ本体 / 部品 / footnote.ts |
| [frontmatter.ts](./frontmatter.ts.yaml) | ライブラリ本体 / 部品 / frontmatter.ts |
| [gallery.ts](./gallery.ts.yaml) | ライブラリ本体 / 部品 / gallery.ts |
| [gif.ts](./gif.ts.yaml) | ライブラリ本体 / 部品 / gif.ts |
| [highlight.ts](./highlight.ts.yaml) | ライブラリ本体 / 部品 / highlight.ts |
| [hint.ts](./hint.ts.yaml) | ライブラリ本体 / 図 / hint.ts |
| [icons.ts](./icons.ts.yaml) | ライブラリ本体 / 図 / icons.ts |
| [image.ts](./image.ts.yaml) | ライブラリ本体 / 部品 / image.ts |
| [inline-icon.ts](./inline-icon.ts.yaml) | ライブラリ本体 / 部品 / inline-icon.ts |
| [kbd.ts](./kbd.ts.yaml) | ライブラリ本体 / 部品 / kbd.ts |
| [layout-columns.ts](./layout-columns.ts.yaml) | ライブラリ本体 / 部品 / layout-columns.ts |
| [lightbox.ts](./lightbox.ts.yaml) | ライブラリ本体 / 部品 / lightbox.ts |
| [map.ts](./map.ts.yaml) | ライブラリ本体 / map / 描画と操作 / map.ts |
| [media.ts](./media.ts.yaml) | ライブラリ本体 / 部品 / media.ts |
| [mermaid.ts](./mermaid.ts.yaml) | ライブラリ本体 / mermaid / mermaid.ts |
| [notice.ts](./notice.ts.yaml) | ライブラリ本体 / 部品 / notice.ts |
| [own.ts](./own.ts.yaml) | ライブラリ本体 / 部品 / own.ts |
| [param.ts](./param.ts.yaml) | ライブラリ本体 / 図 / param.ts |
| [revision-picker.ts](./revision-picker.ts.yaml) | ライブラリ本体 / 差分 / revision-picker.ts |
| [row-detail.ts](./row-detail.ts.yaml) | ライブラリ本体 / 部品 / row-detail.ts |
| [section.ts](./section.ts.yaml) | ライブラリ本体 / 部品 / section.ts |
| [side-toc.ts](./side-toc.ts.yaml) | ライブラリ本体 / 部品 / side-toc.ts |
| [steps.ts](./steps.ts.yaml) | ライブラリ本体 / 部品 / steps.ts |
| [syntax-warning.ts](./syntax-warning.ts.yaml) | ライブラリ本体 / 部品 / syntax-warning.ts |
| [table.ts](./table.ts.yaml) | ライブラリ本体 / 部品 / table.ts |
| [tabs.ts](./tabs.ts.yaml) | ライブラリ本体 / 部品 / tabs.ts |
| [term-tip.ts](./term-tip.ts.yaml) | ライブラリ本体 / 索引と用語 / term-tip.ts |
| [text-color.ts](./text-color.ts.yaml) | ライブラリ本体 / 部品 / text-color.ts |
| [toc.ts](./toc.ts.yaml) | ライブラリ本体 / 部品 / toc.ts |
| [tree.ts](./tree.ts.yaml) | ライブラリ本体 / 記法 / tree.ts |
| [view.ts](./view.ts.yaml) | ライブラリ本体 / ビューとコメント / view.ts |
| [wide.ts](./wide.ts.yaml) | ライブラリ本体 / 部品 / wide.ts |

<!-- /table -->
