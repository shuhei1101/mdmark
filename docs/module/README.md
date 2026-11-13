# module

クラス / 関数 / 定数を物理ファイルごとにまとめる（単体テストの元）

## 目次

<!-- table: data -->

| ページ | 概要 |
| --- | --- |
| [VS Code 拡張機能 / ビルドと配布 / vscode-release.yml](./MOD-472-83.yml.yaml) | VS Code 拡張機能 / ビルドと配布 / vscode-release.yml |
| [ライブラリ本体 / 部品の描画 / main.ts](./MOD-472-341.ts.yaml) | ライブラリ本体 / 部品の描画 / main.ts |
| [ライブラリ本体 / 部品の描画 / preview.tsx](./MOD-472-342.tsx.yaml) | ライブラリ本体 / 部品の描画 / preview.tsx |
| [ライブラリ本体 / 部品の描画 / server-html.tsx](./MOD-472-345.tsx.yaml) | ライブラリ本体 / 部品の描画 / server-html.tsx |
| [ライブラリ本体 / 部品の描画 / vscode-theme.tsx](./MOD-472-343.tsx.yaml) | ライブラリ本体 / 部品の描画 / vscode-theme.tsx |
| [ライブラリ本体 / バージョンを上げる / alias-rows.mjs](./MOD-472-152.mjs.yaml) | ライブラリ本体 / バージョンを上げる / alias-rows.mjs |
| [ライブラリ本体 / バージョンを上げる / drop-tag-vocabulary.mjs](./MOD-472-153.mjs.yaml) | ライブラリ本体 / バージョンを上げる / drop-tag-vocabulary.mjs |
| [ライブラリ本体 / 検査 / package.json](./MOD-472-251.json.yaml) | ライブラリ本体 / 検査 / package.json |
| [ライブラリ本体 / ビルド / baseline.ts](./MOD-472-165.ts.yaml) | ライブラリ本体 / ビルド / baseline.ts |
| [ClaudeCodeプラグイン / プラグインのビルド / build-plugin.ts](./MOD-472-14.ts.yaml) | 配布物のビルド（`scripts/build.ts`）から呼ばれ、ガイドの索引を検査してから、フックをまとめ、まとめた依存のライセンスを `plugin/` に書き込む。MCP サーバーとガイドはまとめない。 |
| [ライブラリ本体 / ビルド / build.ts](./MOD-472-166.ts.yaml) | ライブラリ本体 / ビルド / build.ts |
| [ライブラリ本体 / ビルド / bundle.ts](./MOD-472-167.ts.yaml) | ライブラリ本体 / ビルド / bundle.ts |
| [ライブラリ本体 / 検査 / eslint.ts](./MOD-472-252.ts.yaml) | ライブラリ本体 / 検査 / eslint.ts |
| [ライブラリ本体 / 部品の描画 / mermaid-fixtures.ts](./MOD-472-344.ts.yaml) | ライブラリ本体 / 部品の描画 / mermaid-fixtures.ts |
| [ライブラリ本体 / ビルド / migrations.ts](./MOD-472-168.ts.yaml) | ライブラリ本体 / ビルド / migrations.ts |
| [ライブラリ本体 / 部品の描画 / storybook-render.ts](./MOD-472-340.ts.yaml) | ライブラリ本体 / 部品の描画 / storybook-render.ts |
| [ライブラリ本体 / CLI / bundle-module.ts](./MOD-472-119.ts.yaml) | ライブラリ本体 / CLI / bundle-module.ts |
| [ライブラリ本体 / CLI / alias-schema.ts](./MOD-472-123.ts.yaml) | ライブラリ本体 / CLI / alias-schema.ts |
| [ライブラリ本体 / CLI / aliases.ts](./MOD-472-124.ts.yaml) | ライブラリ本体 / CLI / aliases.ts |
| [ライブラリ本体 / CLI / assets.ts](./MOD-472-113.ts.yaml) | ライブラリ本体 / CLI / assets.ts |
| [ライブラリ本体 / バージョンを上げる / backup.ts](./MOD-472-149.ts.yaml) | ライブラリ本体 / バージョンを上げる / backup.ts |
| [ライブラリ本体 / CLI / build.ts](./MOD-472-121.ts.yaml) | ライブラリ本体 / CLI / build.ts |
| [ライブラリ本体 / バージョンを上げる / changelog.ts](./MOD-472-147.ts.yaml) | ライブラリ本体 / バージョンを上げる / changelog.ts |
| [ライブラリ本体 / CLI / check.ts](./MOD-472-110.ts.yaml) | ライブラリ本体 / CLI / check.ts |
| [ライブラリ本体 / CLI / config.ts](./MOD-472-109.ts.yaml) | ライブラリ本体 / CLI / config.ts |
| [ライブラリ本体 / CLI / documents.ts](./MOD-472-117.ts.yaml) | ライブラリ本体 / CLI / documents.ts |
| [ライブラリ本体 / CLI / embed.ts](./MOD-472-112.ts.yaml) | ライブラリ本体 / CLI / embed.ts |
| [ライブラリ本体 / CLI / errors.ts](./MOD-472-107.ts.yaml) | ライブラリ本体 / CLI / errors.ts |
| [ライブラリ本体 / CLI / export.ts](./MOD-472-120.ts.yaml) | ライブラリ本体 / CLI / export.ts |
| [ライブラリ本体 / CLI / git.ts](./MOD-472-122.ts.yaml) | ライブラリ本体 / CLI / git.ts |
| [ライブラリ本体 / CLI / html.ts](./MOD-472-111.ts.yaml) | ライブラリ本体 / CLI / html.ts |
| [ライブラリ本体 / CLI / icons.ts](./MOD-472-126.ts.yaml) | ライブラリ本体 / CLI / icons.ts |
| [ライブラリ本体 / CLI / includes.ts](./MOD-472-108.ts.yaml) | ライブラリ本体 / CLI / includes.ts |
| [ライブラリ本体 / CLI / init.ts](./MOD-472-114.ts.yaml) | ライブラリ本体 / CLI / init.ts |
| [ライブラリ本体 / CLI / issues.ts](./MOD-472-125.ts.yaml) | ライブラリ本体 / CLI / issues.ts |
| [ライブラリ本体 / CLI / main.ts](./MOD-472-115.ts.yaml) | ライブラリ本体 / CLI / main.ts |
| [ライブラリ本体 / CLI / markdown-check.ts](./MOD-472-127.ts.yaml) | ライブラリ本体 / CLI / markdown-check.ts |
| [ライブラリ本体 / バージョンを上げる / migrations.ts](./MOD-472-146.ts.yaml) | ライブラリ本体 / バージョンを上げる / migrations.ts |
| [ライブラリ本体 / バージョンを上げる / prompt.ts](./MOD-472-151.ts.yaml) | ライブラリ本体 / バージョンを上げる / prompt.ts |
| [ライブラリ本体 / バージョンを上げる / upgrade.ts](./MOD-472-150.ts.yaml) | ライブラリ本体 / バージョンを上げる / upgrade.ts |
| [ライブラリ本体 / バージョンを上げる / versions.ts](./MOD-472-148.ts.yaml) | ライブラリ本体 / バージョンを上げる / versions.ts |
| [ライブラリ本体 / 操作 / code-fold-logic.ts](./MOD-472-237.ts.yaml) | ライブラリ本体 / 操作 / code-fold-logic.ts |
| [ライブラリ本体 / ビューとコメント / anchor.ts](./MOD-472-161.ts.yaml) | ライブラリ本体 / ビューとコメント / anchor.ts |
| [ライブラリ本体 / ビューとコメント / bubble.ts](./MOD-472-164.ts.yaml) | ライブラリ本体 / ビューとコメント / bubble.ts |
| [ライブラリ本体 / ビューとコメント / index.ts](./MOD-472-157.ts.yaml) | ライブラリ本体 / ビューとコメント / index.ts |
| [ライブラリ本体 / ビューとコメント / margin.ts](./MOD-472-162.ts.yaml) | ライブラリ本体 / ビューとコメント / margin.ts |
| [ライブラリ本体 / ビューとコメント / spec.ts](./MOD-472-155.ts.yaml) | ライブラリ本体 / ビューとコメント / spec.ts |
| [ライブラリ本体 / CLI / config-files.ts](./MOD-472-116.ts.yaml) | ライブラリ本体 / CLI / config-files.ts |
| [ライブラリ本体 / 設定と機能 / config.ts](./MOD-472-304.ts.yaml) | ライブラリ本体 / 設定と機能 / config.ts |
| [ライブラリ本体 / 図 / definition.ts](./MOD-472-171.ts.yaml) | ライブラリ本体 / 図 / definition.ts |
| [ライブラリ本体 / 図 / er.ts](./MOD-472-176.ts.yaml) | ライブラリ本体 / 図 / er.ts |
| [ライブラリ本体 / 図 / geometry.ts](./MOD-472-173.ts.yaml) | ライブラリ本体 / 図 / geometry.ts |
| [ライブラリ本体 / 差分 / blocks.ts](./MOD-472-191.ts.yaml) | ライブラリ本体 / 差分 / blocks.ts |
| [ライブラリ本体 / 差分 / compute.ts](./MOD-472-190.ts.yaml) | ライブラリ本体 / 差分 / compute.ts |
| [ライブラリ本体 / 差分 / minimap.ts](./MOD-472-193.ts.yaml) | ライブラリ本体 / 差分 / minimap.ts |
| [ライブラリ本体 / 差分 / panel.ts](./MOD-472-192.ts.yaml) | ライブラリ本体 / 差分 / panel.ts |
| [ライブラリ本体 / 差分 / source.ts](./MOD-472-189.ts.yaml) | ライブラリ本体 / 差分 / source.ts |
| [ライブラリ本体 / 拡張 / extensions.ts](./MOD-472-201.ts.yaml) | ライブラリ本体 / 拡張 / extensions.ts |
| [ライブラリ本体 / 設定と機能 / features.ts](./MOD-472-305.ts.yaml) | ライブラリ本体 / 設定と機能 / features.ts |
| [ライブラリ本体 / 描く / highlight-lines.ts](./MOD-472-209.ts.yaml) | ライブラリ本体 / 描く / highlight-lines.ts |
| [ライブラリ本体 / 描く / highlight.ts](./MOD-472-205.ts.yaml) | ライブラリ本体 / 描く / highlight.ts |
| [ライブラリ本体 / 描く / html-scripts.ts](./MOD-472-206.ts.yaml) | ライブラリ本体 / 描く / html-scripts.ts |
| [ライブラリ本体 / 公開の入口 / index.css](./MOD-472-170.css.yaml) | ライブラリ本体 / 公開の入口 / index.css |
| [ライブラリ本体 / 公開の入口 / index.ts](./MOD-472-169.ts.yaml) | ライブラリ本体 / 公開の入口 / index.ts |
| [ライブラリ本体 / 描く / inline-icons.ts](./MOD-472-207.ts.yaml) | ライブラリ本体 / 描く / inline-icons.ts |
| [ライブラリ本体 / 操作 / back-to-top.ts](./MOD-472-223.ts.yaml) | ライブラリ本体 / 操作 / back-to-top.ts |
| [ライブラリ本体 / 操作 / clipboard.ts](./MOD-472-232.ts.yaml) | ライブラリ本体 / 操作 / clipboard.ts |
| [ライブラリ本体 / 操作 / code-blocks.ts](./MOD-472-233.ts.yaml) | ライブラリ本体 / 操作 / code-blocks.ts |
| [ライブラリ本体 / 操作 / code-folds.ts](./MOD-472-225.ts.yaml) | ライブラリ本体 / 操作 / code-folds.ts |
| [ライブラリ本体 / 操作 / csv-raw.ts](./MOD-472-243.ts.yaml) | ライブラリ本体 / 操作 / csv-raw.ts |
| [ライブラリ本体 / 図 / diagram-resize.ts](./MOD-472-179.ts.yaml) | ライブラリ本体 / 図 / diagram-resize.ts |
| [ライブラリ本体 / 図 / diagram-touch.ts](./MOD-472-346.ts.yaml) | ライブラリ本体 / 図 / diagram-touch.ts |
| [ライブラリ本体 / 図 / diagram-tips.ts](./MOD-472-184.ts.yaml) | ライブラリ本体 / 図 / diagram-tips.ts |
| [ライブラリ本体 / 図 / diagrams.ts](./MOD-472-183.ts.yaml) | ライブラリ本体 / 図 / diagrams.ts |
| [ライブラリ本体 / 操作 / embedded-html.ts](./MOD-472-230.ts.yaml) | ライブラリ本体 / 操作 / embedded-html.ts |
| [ライブラリ本体 / 図 / er-folds.ts](./MOD-472-188.ts.yaml) | ライブラリ本体 / 図 / er-folds.ts |
| [ライブラリ本体 / 操作 / footnotes.ts](./MOD-472-238.ts.yaml) | ライブラリ本体 / 操作 / footnotes.ts |
| [ライブラリ本体 / 操作 / gif.ts](./MOD-472-236.ts.yaml) | ライブラリ本体 / 操作 / gif.ts |
| [ライブラリ本体 / 操作 / index.ts](./MOD-472-227.ts.yaml) | ライブラリ本体 / 操作 / index.ts |
| [ライブラリ本体 / 操作 / lightbox.ts](./MOD-472-224.ts.yaml) | ライブラリ本体 / 操作 / lightbox.ts |
| [ライブラリ本体 / 図 / params.ts](./MOD-472-185.ts.yaml) | ライブラリ本体 / 図 / params.ts |
| [ライブラリ本体 / 操作 / placement.ts](./MOD-472-231.ts.yaml) | ライブラリ本体 / 操作 / placement.ts |
| [ライブラリ本体 / 操作 / scroller.ts](./MOD-472-234.ts.yaml) | ライブラリ本体 / 操作 / scroller.ts |
| [ライブラリ本体 / 操作 / sections.ts](./MOD-472-222.ts.yaml) | ライブラリ本体 / 操作 / sections.ts |
| [ライブラリ本体 / 操作 / side-toc.ts](./MOD-472-219.ts.yaml) | ライブラリ本体 / 操作 / side-toc.ts |
| [ライブラリ本体 / 操作 / sticky.ts](./MOD-472-221.ts.yaml) | ライブラリ本体 / 操作 / sticky.ts |
| [ライブラリ本体 / 操作 / table-resize.ts](./MOD-472-226.ts.yaml) | ライブラリ本体 / 操作 / table-resize.ts |
| [ライブラリ本体 / 操作 / table-settings.ts](./MOD-472-240.ts.yaml) | ライブラリ本体 / 操作 / table-settings.ts |
| [ライブラリ本体 / 操作 / table-tree.ts](./MOD-472-241.ts.yaml) | ライブラリ本体 / 操作 / table-tree.ts |
| [ライブラリ本体 / 操作 / table-width.ts](./MOD-472-347.ts.yaml) | ライブラリ本体 / 操作 / table-width.ts |
| [ライブラリ本体 / 操作 / tables.ts](./MOD-472-228.ts.yaml) | ライブラリ本体 / 操作 / tables.ts |
| [ライブラリ本体 / 操作 / tabs.ts](./MOD-472-220.ts.yaml) | ライブラリ本体 / 操作 / tabs.ts |
| [ライブラリ本体 / 索引と用語 / terms.ts](./MOD-472-266.ts.yaml) | ライブラリ本体 / 索引と用語 / terms.ts |
| [ライブラリ本体 / 操作 / text.ts](./MOD-472-229.ts.yaml) | ライブラリ本体 / 操作 / text.ts |
| [ライブラリ本体 / 操作 / trees.ts](./MOD-472-235.ts.yaml) | ライブラリ本体 / 操作 / trees.ts |
| [ライブラリ本体 / 操作 / wide.ts](./MOD-472-242.ts.yaml) | ライブラリ本体 / 操作 / wide.ts |
| [ライブラリ本体 / 図 / zoom.ts](./MOD-472-177.ts.yaml) | ライブラリ本体 / 図 / zoom.ts |
| [ライブラリ本体 / 索引と用語 / aliases.ts](./MOD-472-260.ts.yaml) | ライブラリ本体 / 索引と用語 / aliases.ts |
| [ライブラリ本体 / 索引と用語 / check.ts](./MOD-472-256.ts.yaml) | ライブラリ本体 / 索引と用語 / check.ts |
| [ライブラリ本体 / 索引と用語 / dictionary.ts](./MOD-472-257.ts.yaml) | ライブラリ本体 / 索引と用語 / dictionary.ts |
| [ライブラリ本体 / 索引と用語 / index-shape.ts](./MOD-472-254.ts.yaml) | ライブラリ本体 / 索引と用語 / index-shape.ts |
| [ライブラリ本体 / 索引と用語 / matches.ts](./MOD-472-258.ts.yaml) | ライブラリ本体 / 索引と用語 / matches.ts |
| [ライブラリ本体 / 索引と用語 / paths.ts](./MOD-472-262.ts.yaml) | ライブラリ本体 / 索引と用語 / paths.ts |
| [ライブラリ本体 / 索引と用語 / positions.ts](./MOD-472-267.ts.yaml) | ライブラリ本体 / 索引と用語 / positions.ts |
| [ライブラリ本体 / 索引と用語 / references.ts](./MOD-472-255.ts.yaml) | ライブラリ本体 / 索引と用語 / references.ts |
| [ライブラリ本体 / 描く / libraries.ts](./MOD-472-204.ts.yaml) | ライブラリ本体 / 描く / libraries.ts |
| [ライブラリ本体 / map / 描画と操作 / band.ts](./MOD-472-132.ts.yaml) | ライブラリ本体 / map / 描画と操作 / band.ts |
| [ライブラリ本体 / map / 点検 / check.ts](./MOD-472-135.ts.yaml) | ライブラリ本体 / map / 点検 / check.ts |
| [ライブラリ本体 / map / 読み取り / data.ts](./MOD-472-139.ts.yaml) | ライブラリ本体 / map / 読み取り / data.ts |
| [ライブラリ本体 / map / 描画と操作 / drag.ts](./MOD-472-134.ts.yaml) | ライブラリ本体 / map / 描画と操作 / drag.ts |
| [ライブラリ本体 / map / 描画と操作 / flow-view.ts](./MOD-472-130.ts.yaml) | ライブラリ本体 / map / 描画と操作 / flow-view.ts |
| [ライブラリ本体 / map / 読み取り / flowchart.ts](./MOD-472-137.ts.yaml) | ライブラリ本体 / map / 読み取り / flowchart.ts |
| [ライブラリ本体 / map / 描画と操作 / index.ts](./MOD-472-128.ts.yaml) | ライブラリ本体 / map / 描画と操作 / index.ts |
| [ライブラリ本体 / map / 配置 / layout.ts](./MOD-472-141.ts.yaml) | ライブラリ本体 / map / 配置 / layout.ts |
| [ライブラリ本体 / map / 点検 / lucide-names.ts](./MOD-472-136.ts.yaml) | ライブラリ本体 / map / 点検 / lucide-names.ts |
| [ライブラリ本体 / map / 配置 / sequence-rows.ts](./MOD-472-142.ts.yaml) | ライブラリ本体 / map / 配置 / sequence-rows.ts |
| [ライブラリ本体 / map / 描画と操作 / sequence-view.ts](./MOD-472-131.ts.yaml) | ライブラリ本体 / map / 描画と操作 / sequence-view.ts |
| [ライブラリ本体 / map / 読み取り / sequence.ts](./MOD-472-138.ts.yaml) | ライブラリ本体 / map / 読み取り / sequence.ts |
| [ライブラリ本体 / map / 読み取り / spec.ts](./MOD-472-140.ts.yaml) | ライブラリ本体 / map / 読み取り / spec.ts |
| [ライブラリ本体 / map / 描画と操作 / state.ts](./MOD-472-129.ts.yaml) | ライブラリ本体 / map / 描画と操作 / state.ts |
| [ライブラリ本体 / mermaid / mermaid-source.ts](./MOD-472-144.ts.yaml) | ライブラリ本体 / mermaid / mermaid-source.ts |
| [ライブラリ本体 / mermaid / mermaid.ts](./MOD-472-143.ts.yaml) | ライブラリ本体 / mermaid / mermaid.ts |
| [ライブラリ本体 / ビューとコメント / mount-parts.ts](./MOD-472-158.ts.yaml) | ライブラリ本体 / ビューとコメント / mount-parts.ts |
| [ライブラリ本体 / 描く / mount.ts](./MOD-472-203.ts.yaml) | ライブラリ本体 / 描く / mount.ts |
| [ライブラリ本体 / ビューとコメント / part-modules.ts](./MOD-472-159.ts.yaml) | ライブラリ本体 / ビューとコメント / part-modules.ts |
| [ライブラリ本体 / 部品 / back-to-top.ts](./MOD-472-324.ts.yaml) | ライブラリ本体 / 部品 / back-to-top.ts |
| [ライブラリ本体 / 索引と用語 / backlinks.ts](./MOD-472-265.ts.yaml) | ライブラリ本体 / 索引と用語 / backlinks.ts |
| [ライブラリ本体 / 部品 / badge.ts](./MOD-472-318.ts.yaml) | ライブラリ本体 / 部品 / badge.ts |
| [ライブラリ本体 / 記法 / callout.ts](./MOD-472-275.ts.yaml) | ライブラリ本体 / 記法 / callout.ts |
| [ライブラリ本体 / 部品 / card-grid.ts](./MOD-472-308.ts.yaml) | ライブラリ本体 / 部品 / card-grid.ts |
| [ライブラリ本体 / 部品 / card.ts](./MOD-472-332.ts.yaml) | ライブラリ本体 / 部品 / card.ts |
| [ライブラリ本体 / 図 / chart.ts](./MOD-472-174.ts.yaml) | ライブラリ本体 / 図 / chart.ts |
| [ライブラリ本体 / 部品 / code-block.ts](./MOD-472-306.ts.yaml) | ライブラリ本体 / 部品 / code-block.ts |
| [ライブラリ本体 / 部品 / collapsible.ts](./MOD-472-325.ts.yaml) | ライブラリ本体 / 部品 / collapsible.ts |
| [ライブラリ本体 / 部品 / colors.ts](./MOD-472-312.ts.yaml) | ライブラリ本体 / 部品 / colors.ts |
| [ライブラリ本体 / ビューとコメント / comment.ts](./MOD-472-163.ts.yaml) | ライブラリ本体 / ビューとコメント / comment.ts |
| [ライブラリ本体 / 図 / diagram.ts](./MOD-472-172.ts.yaml) | ライブラリ本体 / 図 / diagram.ts |
| [ライブラリ本体 / 差分 / diff-blocks.ts](./MOD-472-200.ts.yaml) | ライブラリ本体 / 差分 / diff-blocks.ts |
| [ライブラリ本体 / 差分 / diff-html.ts](./MOD-472-197.ts.yaml) | ライブラリ本体 / 差分 / diff-html.ts |
| [ライブラリ本体 / 差分 / diff-lines.ts](./MOD-472-196.ts.yaml) | ライブラリ本体 / 差分 / diff-lines.ts |
| [ライブラリ本体 / 差分 / diff-message.ts](./MOD-472-199.ts.yaml) | ライブラリ本体 / 差分 / diff-message.ts |
| [ライブラリ本体 / 差分 / diff-minimap.ts](./MOD-472-198.ts.yaml) | ライブラリ本体 / 差分 / diff-minimap.ts |
| [ライブラリ本体 / 差分 / diff-toggle.ts](./MOD-472-194.ts.yaml) | ライブラリ本体 / 差分 / diff-toggle.ts |
| [ライブラリ本体 / 部品 / doc-list.ts](./MOD-472-323.ts.yaml) | ライブラリ本体 / 部品 / doc-list.ts |
| [ライブラリ本体 / 部品 / embed.ts](./MOD-472-309.ts.yaml) | ライブラリ本体 / 部品 / embed.ts |
| [ライブラリ本体 / 図 / er.ts](./MOD-472-187.ts.yaml) | ライブラリ本体 / 図 / er.ts |
| [ライブラリ本体 / 部品 / escape.ts](./MOD-472-313.ts.yaml) | ライブラリ本体 / 部品 / escape.ts |
| [ライブラリ本体 / 部品 / figure.ts](./MOD-472-322.ts.yaml) | ライブラリ本体 / 部品 / figure.ts |
| [ライブラリ本体 / 部品 / footnote.ts](./MOD-472-333.ts.yaml) | ライブラリ本体 / 部品 / footnote.ts |
| [ライブラリ本体 / 部品 / frontmatter.ts](./MOD-472-339.ts.yaml) | ライブラリ本体 / 部品 / frontmatter.ts |
| [ライブラリ本体 / 部品 / gallery.ts](./MOD-472-328.ts.yaml) | ライブラリ本体 / 部品 / gallery.ts |
| [ライブラリ本体 / 部品 / gif.ts](./MOD-472-331.ts.yaml) | ライブラリ本体 / 部品 / gif.ts |
| [ライブラリ本体 / 部品 / highlight.ts](./MOD-472-336.ts.yaml) | ライブラリ本体 / 部品 / highlight.ts |
| [ライブラリ本体 / 図 / hint.ts](./MOD-472-186.ts.yaml) | ライブラリ本体 / 図 / hint.ts |
| [ライブラリ本体 / 図 / icons.ts](./MOD-472-180.ts.yaml) | ライブラリ本体 / 図 / icons.ts |
| [ライブラリ本体 / 部品 / image.ts](./MOD-472-327.ts.yaml) | ライブラリ本体 / 部品 / image.ts |
| [ライブラリ本体 / 部品 / inline-icon.ts](./MOD-472-334.ts.yaml) | ライブラリ本体 / 部品 / inline-icon.ts |
| [ライブラリ本体 / 部品 / kbd.ts](./MOD-472-335.ts.yaml) | ライブラリ本体 / 部品 / kbd.ts |
| [ライブラリ本体 / 部品 / layout-columns.ts](./MOD-472-337.ts.yaml) | ライブラリ本体 / 部品 / layout-columns.ts |
| [ライブラリ本体 / 部品 / lightbox.ts](./MOD-472-329.ts.yaml) | ライブラリ本体 / 部品 / lightbox.ts |
| [ライブラリ本体 / map / 描画と操作 / map.ts](./MOD-472-133.ts.yaml) | ライブラリ本体 / map / 描画と操作 / map.ts |
| [ライブラリ本体 / 部品 / media.ts](./MOD-472-330.ts.yaml) | ライブラリ本体 / 部品 / media.ts |
| [ライブラリ本体 / mermaid / mermaid.ts](./MOD-472-145.ts.yaml) | ライブラリ本体 / mermaid / mermaid.ts |
| [ライブラリ本体 / 部品 / notice.ts](./MOD-472-310.ts.yaml) | ライブラリ本体 / 部品 / notice.ts |
| [ライブラリ本体 / 部品 / own.ts](./MOD-472-311.ts.yaml) | ライブラリ本体 / 部品 / own.ts |
| [ライブラリ本体 / 図 / param.ts](./MOD-472-181.ts.yaml) | ライブラリ本体 / 図 / param.ts |
| [ライブラリ本体 / 差分 / revision-picker.ts](./MOD-472-195.ts.yaml) | ライブラリ本体 / 差分 / revision-picker.ts |
| [ライブラリ本体 / 部品 / row-detail.ts](./MOD-472-321.ts.yaml) | ライブラリ本体 / 部品 / row-detail.ts |
| [ライブラリ本体 / 部品 / section.ts](./MOD-472-320.ts.yaml) | ライブラリ本体 / 部品 / section.ts |
| [ライブラリ本体 / 部品 / side-toc.ts](./MOD-472-307.ts.yaml) | ライブラリ本体 / 部品 / side-toc.ts |
| [ライブラリ本体 / 部品 / steps.ts](./MOD-472-317.ts.yaml) | ライブラリ本体 / 部品 / steps.ts |
| [ライブラリ本体 / 部品 / syntax-warning.ts](./MOD-472-314.ts.yaml) | ライブラリ本体 / 部品 / syntax-warning.ts |
| [ライブラリ本体 / 部品 / table.ts](./MOD-472-315.ts.yaml) | ライブラリ本体 / 部品 / table.ts |
| [ライブラリ本体 / 部品 / tabs.ts](./MOD-472-316.ts.yaml) | ライブラリ本体 / 部品 / tabs.ts |
| [ライブラリ本体 / 索引と用語 / term-tip.ts](./MOD-472-261.ts.yaml) | ライブラリ本体 / 索引と用語 / term-tip.ts |
| [ライブラリ本体 / 部品 / text-color.ts](./MOD-472-326.ts.yaml) | ライブラリ本体 / 部品 / text-color.ts |
| [ライブラリ本体 / 部品 / toc.ts](./MOD-472-319.ts.yaml) | ライブラリ本体 / 部品 / toc.ts |
| [ライブラリ本体 / 記法 / tree.ts](./MOD-472-269.ts.yaml) | ライブラリ本体 / 記法 / tree.ts |
| [ライブラリ本体 / ビューとコメント / view.ts](./MOD-472-160.ts.yaml) | ライブラリ本体 / ビューとコメント / view.ts |
| [ライブラリ本体 / 部品 / wide.ts](./MOD-472-338.ts.yaml) | ライブラリ本体 / 部品 / wide.ts |
| [ClaudeCodeプラグイン / MCPサーバー / arguments.ts](./MOD-472-49.ts.yaml) | ClaudeCodeプラグイン / MCPサーバー / arguments.ts |
| [ClaudeCodeプラグイン / ガイド / guide.ts](./MOD-472-4.ts.yaml) | ガイドの索引（名前・参照するとき・概要・本文のページ）の構造を検査する。プラグインのビルドが使用する。 |
| [ClaudeCodeプラグイン / MCPサーバー / http.ts](./MOD-472-51.ts.yaml) | ClaudeCodeプラグイン / MCPサーバー / http.ts |
| [ClaudeCodeプラグイン / MCPサーバー / mcp.ts](./MOD-472-50.ts.yaml) | ClaudeCodeプラグイン / MCPサーバー / mcp.ts |
| [ClaudeCodeプラグイン / ポート / port.ts](./MOD-472-15.ts.yaml) | `127.0.0.1` のポートが待ち受けているかの確認と、待ち受けるポートの読み取り（`mdmark serve`・SessionStart のフック・`setup.js` が使用する）。 |
| [ClaudeCodeプラグイン / フック / pre-tool-use.ts](./MOD-472-13.ts.yaml) | プラグインの `hooks/hooks.json` が `node` で起動する処理。PreToolUse で作業のフォルダを MCP のツールの引数 `project_dir` に入れる。 |
| [ClaudeCodeプラグイン / SessionStartのフック / session-start.ts](./MOD-472-3.ts.yaml) | プラグインの `hooks/hooks.json` の SessionStart が `node` で起動する処理。常駐サーバーが待ち受けていないときだけ、そのことを 1 行で指定する。 |
| [ClaudeCodeプラグイン / セットアップ / キーの一覧 / keys.ts](./MOD-472-6.ts.yaml) | `keys` の結果を作る。 |
| [ClaudeCodeプラグイン / セットアップ / 入口 / main.ts](./MOD-472-8.ts.yaml) | `setup.js` の入口とサブコマンドの振り分け。 |
| [ClaudeCodeプラグイン / セットアップ / パス / paths.ts](./MOD-472-7.ts.yaml) | 端末の設定・状態の配置場所・`settings.json`・unit のファイルのパスと、起動の方法・unit の名前・tmux のセッション名の読み取り。 |
| [ClaudeCodeプラグイン / セットアップ / 起動 / server.ts](./MOD-472-12.ts.yaml) | `start-server` の起動の方法の決定・systemd --user の unit と tmux のセッションでの起動・待ち受けの確認。 |
| [ClaudeCodeプラグイン / セットアップ / 状態 / status.ts](./MOD-472-11.ts.yaml) | `status` の結果を作る。 |
| [ClaudeCodeプラグイン / セットアップ / systemd / systemd.ts](./MOD-472-5.ts.yaml) | `start-server`・`status` が呼ぶ systemd --user の確認・unit のファイルの組み立て・unit の状態の読み取り。 |
| [ClaudeCodeプラグイン / セットアップ / 書き込み / write.ts](./MOD-472-10.ts.yaml) | `write-settings`・`write-config` と `settings.json` の `env` の書き換え。 |
| [ClaudeCodeプラグイン / CSSのテンプレート / templates.ts](./MOD-472-1.ts.yaml) | 端末の設定のフォルダの `templates/css/` に配置する CSS のテンプレートの索引を読み込み・検査し・記載し、テンプレートを一覧・登録・配置する。MCP の `list_templates`・`add_template`・`apply_template` の処理が呼ぶ。 |
| [ClaudeCodeプラグイン / MCPサーバー / tools.ts](./MOD-472-48.ts.yaml) | ClaudeCodeプラグイン / MCPサーバー / tools.ts |
| [ライブラリ本体 / 描く / print.ts](./MOD-472-208.ts.yaml) | ライブラリ本体 / 描く / print.ts |
| [ライブラリ本体 / 描画 / frontmatter.ts](./MOD-472-217.ts.yaml) | ライブラリ本体 / 描画 / frontmatter.ts |
| [ライブラリ本体 / 描画 / index.ts](./MOD-472-212.ts.yaml) | ライブラリ本体 / 描画 / index.ts |
| [ライブラリ本体 / 描画 / marks.ts](./MOD-472-210.ts.yaml) | ライブラリ本体 / 描画 / marks.ts |
| [ライブラリ本体 / 描画 / page.ts](./MOD-472-215.ts.yaml) | ライブラリ本体 / 描画 / page.ts |
| [ライブラリ本体 / 描画 / parser.ts](./MOD-472-211.ts.yaml) | ライブラリ本体 / 描画 / parser.ts |
| [ライブラリ本体 / 描画 / sanitize.ts](./MOD-472-214.ts.yaml) | ライブラリ本体 / 描画 / sanitize.ts |
| [ライブラリ本体 / 描画 / scope-css.ts](./MOD-472-216.ts.yaml) | ライブラリ本体 / 描画 / scope-css.ts |
| [ライブラリ本体 / 索引と用語 / backlinks.ts](./MOD-472-264.ts.yaml) | ライブラリ本体 / 索引と用語 / backlinks.ts |
| [ライブラリ本体 / 記法 / badges.ts](./MOD-472-286.ts.yaml) | ライブラリ本体 / 記法 / badges.ts |
| [ライブラリ本体 / 記法 / callouts.ts](./MOD-472-284.ts.yaml) | ライブラリ本体 / 記法 / callouts.ts |
| [ライブラリ本体 / 記法 / card-grid.ts](./MOD-472-296.ts.yaml) | ライブラリ本体 / 記法 / card-grid.ts |
| [ライブラリ本体 / 記法 / cards.ts](./MOD-472-272.ts.yaml) | ライブラリ本体 / 記法 / cards.ts |
| [ライブラリ本体 / 記法 / code-blocks.ts](./MOD-472-276.ts.yaml) | ライブラリ本体 / 記法 / code-blocks.ts |
| [ライブラリ本体 / 記法 / collapse.ts](./MOD-472-270.ts.yaml) | ライブラリ本体 / 記法 / collapse.ts |
| [ライブラリ本体 / 記法 / csv.ts](./MOD-472-301.ts.yaml) | ライブラリ本体 / 記法 / csv.ts |
| [ライブラリ本体 / 記法 / details.ts](./MOD-472-297.ts.yaml) | ライブラリ本体 / 記法 / details.ts |
| [ライブラリ本体 / 図 / diagrams.ts](./MOD-472-182.ts.yaml) | ライブラリ本体 / 図 / diagrams.ts |
| [ライブラリ本体 / 記法 / figures.ts](./MOD-472-287.ts.yaml) | ライブラリ本体 / 記法 / figures.ts |
| [ライブラリ本体 / 記法 / footnotes.ts](./MOD-472-274.ts.yaml) | ライブラリ本体 / 記法 / footnotes.ts |
| [ライブラリ本体 / 記法 / frontmatter.ts](./MOD-472-302.ts.yaml) | ライブラリ本体 / 記法 / frontmatter.ts |
| [ライブラリ本体 / 記法 / gallery.ts](./MOD-472-277.ts.yaml) | ライブラリ本体 / 記法 / gallery.ts |
| [ライブラリ本体 / 索引と用語 / glossary.ts](./MOD-472-259.ts.yaml) | ライブラリ本体 / 索引と用語 / glossary.ts |
| [ライブラリ本体 / 記法 / headings.ts](./MOD-472-279.ts.yaml) | ライブラリ本体 / 記法 / headings.ts |
| [ライブラリ本体 / 記法 / highlight.ts](./MOD-472-294.ts.yaml) | ライブラリ本体 / 記法 / highlight.ts |
| [ライブラリ本体 / 記法 / html.ts](./MOD-472-289.ts.yaml) | ライブラリ本体 / 記法 / html.ts |
| [ライブラリ本体 / 記法 / images.ts](./MOD-472-271.ts.yaml) | ライブラリ本体 / 記法 / images.ts |
| [ライブラリ本体 / 記法 / includes.ts](./MOD-472-299.ts.yaml) | ライブラリ本体 / 記法 / includes.ts |
| [ライブラリ本体 / 記法 / inline-icons.ts](./MOD-472-278.ts.yaml) | ライブラリ本体 / 記法 / inline-icons.ts |
| [ライブラリ本体 / 記法 / kbd.ts](./MOD-472-293.ts.yaml) | ライブラリ本体 / 記法 / kbd.ts |
| [ライブラリ本体 / 記法 / layout-columns.ts](./MOD-472-295.ts.yaml) | ライブラリ本体 / 記法 / layout-columns.ts |
| [ライブラリ本体 / 記法 / map.ts](./MOD-472-303.ts.yaml) | ライブラリ本体 / 記法 / map.ts |
| [ライブラリ本体 / 記法 / pagebreak.ts](./MOD-472-298.ts.yaml) | ライブラリ本体 / 記法 / pagebreak.ts |
| [ライブラリ本体 / 記法 / row-details.ts](./MOD-472-281.ts.yaml) | ライブラリ本体 / 記法 / row-details.ts |
| [ライブラリ本体 / 記法 / sections.ts](./MOD-472-280.ts.yaml) | ライブラリ本体 / 記法 / sections.ts |
| [ライブラリ本体 / 記法 / steps.ts](./MOD-472-283.ts.yaml) | ライブラリ本体 / 記法 / steps.ts |
| [ライブラリ本体 / 記法 / table-cells.ts](./MOD-472-273.ts.yaml) | ライブラリ本体 / 記法 / table-cells.ts |
| [ライブラリ本体 / 記法 / table-tree.ts](./MOD-472-292.ts.yaml) | ライブラリ本体 / 記法 / table-tree.ts |
| [ライブラリ本体 / 記法 / tables.ts](./MOD-472-268.ts.yaml) | ライブラリ本体 / 記法 / tables.ts |
| [ライブラリ本体 / 記法 / tabs.ts](./MOD-472-282.ts.yaml) | ライブラリ本体 / 記法 / tabs.ts |
| [ライブラリ本体 / 索引と用語 / terms.ts](./MOD-472-263.ts.yaml) | ライブラリ本体 / 索引と用語 / terms.ts |
| [ライブラリ本体 / 記法 / text-color.ts](./MOD-472-291.ts.yaml) | ライブラリ本体 / 記法 / text-color.ts |
| [ライブラリ本体 / 記法 / toc.ts](./MOD-472-288.ts.yaml) | ライブラリ本体 / 記法 / toc.ts |
| [ライブラリ本体 / 記法 / tree.ts](./MOD-472-285.ts.yaml) | ライブラリ本体 / 記法 / tree.ts |
| [ライブラリ本体 / 記法 / views.ts](./MOD-472-290.ts.yaml) | ライブラリ本体 / 記法 / views.ts |
| [ライブラリ本体 / 描画 / warnings.ts](./MOD-472-213.ts.yaml) | ライブラリ本体 / 描画 / warnings.ts |
| [ライブラリ本体 / 記法 / wide.ts](./MOD-472-300.ts.yaml) | ライブラリ本体 / 記法 / wide.ts |
| [ライブラリ本体 / CLI / used.ts](./MOD-472-118.ts.yaml) | ライブラリ本体 / CLI / used.ts |
| [ライブラリ本体 / 拡張 / standard-schema.ts](./MOD-472-202.ts.yaml) | ライブラリ本体 / 拡張 / standard-schema.ts |
| [ライブラリ本体 / 操作 / table-logic.ts](./MOD-472-218.ts.yaml) | ライブラリ本体 / 操作 / table-logic.ts |
| [ライブラリ本体 / 操作 / tree-logic.ts](./MOD-472-239.ts.yaml) | ライブラリ本体 / 操作 / tree-logic.ts |
| [ライブラリ本体 / 書き出したHTMLの起動 / bundle.ts](./MOD-472-247.ts.yaml) | ライブラリ本体 / 書き出したHTMLの起動 / bundle.ts |
| [ライブラリ本体 / 書き出したHTMLの起動 / index.ts](./MOD-472-248.ts.yaml) | ライブラリ本体 / 書き出したHTMLの起動 / index.ts |
| [ライブラリ本体 / 書き出したHTMLの起動 / modules.ts](./MOD-472-244.ts.yaml) | ライブラリ本体 / 書き出したHTMLの起動 / modules.ts |
| [ライブラリ本体 / 書き出したHTMLの起動 / route.ts](./MOD-472-246.ts.yaml) | ライブラリ本体 / 書き出したHTMLの起動 / route.ts |
| [ライブラリ本体 / 書き出したHTMLの起動 / view-state.ts](./MOD-472-245.ts.yaml) | ライブラリ本体 / 書き出したHTMLの起動 / view-state.ts |
| [ライブラリ本体 / ビューとコメント / index.ts](./MOD-472-156.ts.yaml) | ライブラリ本体 / ビューとコメント / index.ts |
| [ライブラリ本体 / ビューとコメント / spec.ts](./MOD-472-154.ts.yaml) | ライブラリ本体 / ビューとコメント / spec.ts |
| [ライブラリ本体 / 検査 / git-env.ts](./MOD-472-253.ts.yaml) | ライブラリ本体 / 検査 / git-env.ts |
| [ライブラリ本体 / 検査 / eslint.config.js](./MOD-472-250.js.yaml) | ライブラリ本体 / 検査 / eslint.config.js |
| [ライブラリ本体 / 検査 / package.json](./MOD-472-249.json.yaml) | ライブラリ本体 / 検査 / package.json |
| [VS Code 拡張機能 / Webview / components.json](./MOD-472-62.json.yaml) | VS Code 拡張機能 / Webview / components.json |
| [VS Code 拡張機能 / ビルドと配布 / package.json](./MOD-472-84.json.yaml) | VS Code 拡張機能 / ビルドと配布 / package.json |
| [VS Code 拡張機能 / ビルドと配布 / build.ts](./MOD-472-85.ts.yaml) | VS Code 拡張機能 / ビルドと配布 / build.ts |
| [VS Code 拡張機能 / ビルドと配布 / release-check.ts](./MOD-472-82.ts.yaml) | VS Code 拡張機能 / ビルドと配布 / release-check.ts |
| [VS Code 拡張機能 / 設定 / config-file.ts](./MOD-472-105.ts.yaml) | VS Code 拡張機能 / 設定 / config-file.ts |
| [VS Code 拡張機能 / 設定 / config.ts](./MOD-472-104.ts.yaml) | VS Code 拡張機能 / 設定 / config.ts |
| [VS Code 拡張機能 / 拡張機能の入口 / deps.ts](./MOD-472-98.ts.yaml) | VS Code 拡張機能 / 拡張機能の入口 / deps.ts |
| [VS Code 拡張機能 / 書き出し / embed.ts](./MOD-472-102.ts.yaml) | VS Code 拡張機能 / 書き出し / embed.ts |
| [VS Code 拡張機能 / 書き出し / export.ts](./MOD-472-99.ts.yaml) | VS Code 拡張機能 / 書き出し / export.ts |
| [VS Code 拡張機能 / 書き出し / html.ts](./MOD-472-100.ts.yaml) | VS Code 拡張機能 / 書き出し / html.ts |
| [VS Code 拡張機能 / 書き出し / write.ts](./MOD-472-101.ts.yaml) | VS Code 拡張機能 / 書き出し / write.ts |
| [VS Code 拡張機能 / 拡張機能の入口 / extension.ts](./MOD-472-96.ts.yaml) | VS Code 拡張機能 / 拡張機能の入口 / extension.ts |
| [VS Code 拡張機能 / 設定 / extensions-bundle.ts](./MOD-472-106.ts.yaml) | VS Code 拡張機能 / 設定 / extensions-bundle.ts |
| [VS Code 拡張機能 / 拡張機能の入口 / log.ts](./MOD-472-97.ts.yaml) | VS Code 拡張機能 / 拡張機能の入口 / log.ts |
| [VS Code 拡張機能 / Webview / messages.ts](./MOD-472-52.ts.yaml) | VS Code 拡張機能 / Webview / messages.ts |
| [VS Code 拡張機能 / プレビュー / assets.ts](./MOD-472-94.ts.yaml) | VS Code 拡張機能 / プレビュー / assets.ts |
| [VS Code 拡張機能 / プレビュー / diff-target.ts](./MOD-472-93.ts.yaml) | VS Code 拡張機能 / プレビュー / diff-target.ts |
| [VS Code 拡張機能 / プレビュー / html.ts](./MOD-472-92.ts.yaml) | VS Code 拡張機能 / プレビュー / html.ts |
| [VS Code 拡張機能 / プレビュー / includes.ts](./MOD-472-95.ts.yaml) | VS Code 拡張機能 / プレビュー / includes.ts |
| [VS Code 拡張機能 / プレビュー / links.ts](./MOD-472-88.ts.yaml) | VS Code 拡張機能 / プレビュー / links.ts |
| [VS Code 拡張機能 / プレビュー / manager.ts](./MOD-472-89.ts.yaml) | VS Code 拡張機能 / プレビュー / manager.ts |
| [VS Code 拡張機能 / プレビュー / panel.ts](./MOD-472-90.ts.yaml) | VS Code 拡張機能 / プレビュー / panel.ts |
| [VS Code 拡張機能 / プレビュー / scroll-guard.ts](./MOD-472-91.ts.yaml) | VS Code 拡張機能 / プレビュー / scroll-guard.ts |
| [VS Code 拡張機能 / 設定 / settings.ts](./MOD-472-103.ts.yaml) | VS Code 拡張機能 / 設定 / settings.ts |
| [VS Code 拡張機能 / 読み込むバージョン / version.ts](./MOD-472-22.ts.yaml) | プレビューと書き出しが読み込む mdmark のバージョンを、設定 `mdmark.version` と GitHub のタグ一覧と前回のバージョンから決める。`vscode` を import しない。 |
| [VS Code 拡張機能 / Webview / app.tsx](./MOD-472-74.tsx.yaml) | VS Code 拡張機能 / Webview / app.tsx |
| [VS Code 拡張機能 / Webview / assets.ts](./MOD-472-70.ts.yaml) | VS Code 拡張機能 / Webview / assets.ts |
| [VS Code 拡張機能 / Webview / boot.ts](./MOD-472-53.ts.yaml) | VS Code 拡張機能 / Webview / boot.ts |
| [VS Code 拡張機能 / Webview / diff-source.ts](./MOD-472-57.ts.yaml) | VS Code 拡張機能 / Webview / diff-source.ts |
| [VS Code 拡張機能 / Webview / document-view.ts](./MOD-472-59.ts.yaml) | VS Code 拡張機能 / Webview / document-view.ts |
| [VS Code 拡張機能 / Webview / use-document-view.ts](./MOD-472-64.ts.yaml) | VS Code 拡張機能 / Webview / use-document-view.ts |
| [VS Code 拡張機能 / Webview / use-host-messages.ts](./MOD-472-65.ts.yaml) | VS Code 拡張機能 / Webview / use-host-messages.ts |
| [VS Code 拡張機能 / Webview / use-link-clicks.ts](./MOD-472-67.ts.yaml) | VS Code 拡張機能 / Webview / use-link-clicks.ts |
| [VS Code 拡張機能 / Webview / use-load-mdmark.ts](./MOD-472-60.ts.yaml) | VS Code 拡張機能 / Webview / use-load-mdmark.ts |
| [VS Code 拡張機能 / Webview / use-media-errors.ts](./MOD-472-68.ts.yaml) | VS Code 拡張機能 / Webview / use-media-errors.ts |
| [VS Code 拡張機能 / Webview / use-scroll-sync.ts](./MOD-472-66.ts.yaml) | VS Code 拡張機能 / Webview / use-scroll-sync.ts |
| [VS Code 拡張機能 / Webview / load-mdmark.ts](./MOD-472-55.ts.yaml) | VS Code 拡張機能 / Webview / load-mdmark.ts |
| [VS Code 拡張機能 / Webview / panel-screen.tsx](./MOD-472-75.tsx.yaml) | VS Code 拡張機能 / Webview / panel-screen.tsx |
| [VS Code 拡張機能 / Webview / scroll.ts](./MOD-472-56.ts.yaml) | VS Code 拡張機能 / Webview / scroll.ts |
| [VS Code 拡張機能 / Webview / main.tsx](./MOD-472-63.tsx.yaml) | VS Code 拡張機能 / Webview / main.tsx |
| [VS Code 拡張機能 / Webview / vscode-api.ts](./MOD-472-54.ts.yaml) | VS Code 拡張機能 / Webview / vscode-api.ts |
| [VS Code 拡張機能 / Webview / config-band.tsx](./MOD-472-76.tsx.yaml) | VS Code 拡張機能 / Webview / config-band.tsx |
| [VS Code 拡張機能 / Webview / preview-status.tsx](./MOD-472-58.tsx.yaml) | VS Code 拡張機能 / Webview / preview-status.tsx |
| [VS Code 拡張機能 / Webview / alert.tsx](./MOD-472-77.tsx.yaml) | VS Code 拡張機能 / Webview / alert.tsx |
| [VS Code 拡張機能 / Webview / button.tsx](./MOD-472-78.tsx.yaml) | VS Code 拡張機能 / Webview / button.tsx |
| [VS Code 拡張機能 / Webview / spinner.tsx](./MOD-472-79.tsx.yaml) | VS Code 拡張機能 / Webview / spinner.tsx |
| [VS Code 拡張機能 / Webview / cn.ts](./MOD-472-69.ts.yaml) | VS Code 拡張機能 / Webview / cn.ts |
| [VS Code 拡張機能 / Webview / media-error.ts](./MOD-472-71.ts.yaml) | VS Code 拡張機能 / Webview / media-error.ts |
| [VS Code 拡張機能 / Webview / panel.css](./MOD-472-80.css.yaml) | VS Code 拡張機能 / Webview / panel.css |
| [VS Code 拡張機能 / Webview / fake-vscode-api.ts](./MOD-472-72.ts.yaml) | VS Code 拡張機能 / Webview / fake-vscode-api.ts |
| [VS Code 拡張機能 / Webview / handlers.ts](./MOD-472-73.ts.yaml) | VS Code 拡張機能 / Webview / handlers.ts |
| [VS Code 拡張機能 / ビルドと配布 / index.ts](./MOD-472-86.ts.yaml) | VS Code 拡張機能 / ビルドと配布 / index.ts |
| [VS Code 拡張機能 / ビルドと配布 / run.ts](./MOD-472-81.ts.yaml) | VS Code 拡張機能 / ビルドと配布 / run.ts |
| [VS Code 拡張機能 / ビルドと配布 / stub-server.ts](./MOD-472-87.ts.yaml) | VS Code 拡張機能 / ビルドと配布 / stub-server.ts |
| [VS Code 拡張機能 / Webview / vite.config.ts](./MOD-472-61.ts.yaml) | VS Code 拡張機能 / Webview / vite.config.ts |
| [ClaudeCodeプラグイン / MCPサーバー](./MOD-472-2.yaml) | `mdmark serve` が 127.0.0.1 の Streamable HTTP で待ち受ける MCP の常駐サーバー。`export_html`・`build_site`・`check`・`list_templates`・`add_template`・`apply_template` を登録し、作業のフォルダを引数の `project_dir` で受け、引数を検査してから CLI と同じ処理を呼ぶ。`src/cli/main.ts` は読み込まない。 |
| [ClaudeCodeプラグイン / セットアップ / 全体](./MOD-472-9.yaml) | `global-setup`・`setup` のスキルが Bash で呼ぶ `plugin/bin/setup.js` のサブコマンド（`status`・`keys`・`write-settings`・`start-server`・`write-config`）と、スキルの本文。 |
| [VS Code 拡張機能 / Webview](./MOD-472-16.yaml) | プレビューのパネルの中で動く React の画面と、配布物を読み込む前にも出す部品。jsDelivr の mdmark を読み込んで `mount`・`update` で描き、スクロール・リンク・状態の表示を担う。拡張機能とのメッセージの型も持つ。 |
| [VS Code 拡張機能 / ビルドと配布](./MOD-472-17.yaml) | 拡張機能を esbuild、Webview を Vite で書き出し、タグとバージョンを照合して .vsix を GitHub Release に添える。拡張機能ホストで実行する結合テストの起動も持つ。配布物には入らない。 |
| [VS Code 拡張機能 / プレビュー](./MOD-472-18.yaml) | Markdown ごとのプレビューのパネルを開き、Webview の HTML・CSP を組み、再描画し・スクロールの同期・リンクの振り分けを担う拡張機能の側の処理。 |
| [VS Code 拡張機能 / 拡張機能の入口](./MOD-472-19.yaml) | 拡張機能の `activate` と、`vscode/package.json` の `contributes`（コマンド・ショートカット・メニュー・設定）。コマンドと VS Code の通知を各機能へつなぐ。 |
| [VS Code 拡張機能 / 書き出し](./MOD-472-20.yaml) | 開いている Markdown を jsDelivr の配布物で描く 1 つの HTML に書き出し、ブラウザで開き、印刷のダイアログを出させる。 |
| [VS Code 拡張機能 / 設定](./MOD-472-21.yaml) | VS Code の設定 `mdmark.*` の読み取りと、`mdmark.config.yaml` の場所の解決・端末の設定と重ねた設定の読み取り・`mount` に指定するキーの取り出し・雛形の作成。 |
| [ライブラリ本体 / CLI](./MOD-472-23.yaml) | `dist/cli.js` にまとめる Node の CLI。引数を読み込んでコマンドを振り分け、設定と索引と文書を読み込み、`render`・`checkIndex`・`collectReferences` を同じソースから呼んで、雛形の配置・点検・書き出しをする。ファイル・YAML・glob・esbuild を使用するのはこの分類だけにする。 |
| [ライブラリ本体 / map / 全体](./MOD-472-24.yaml) | map の範囲の Mermaid と補足の読み取り・入れ子の自動配置・点検と、`dist/map.js` に分けた描画と操作。 |
| [ライブラリ本体 / map / 描画と操作](./MOD-472-25.yaml) | `dist/map.js` の入口と、構成図・シーケンス図を描いて開閉・中へ入る・選択・移動・案内・再生の操作を付け、状態を sessionStorage とクエリ文字列に保つ処理と、部品の HTML。ブラウザでだけ動く（部品の HTML は Node でも動く）。 |
| [ライブラリ本体 / map / 点検](./MOD-472-26.yaml) | map の範囲の読み取りの項目に、補足が指す ID と設定の `map` の種類・線・アイコンの照合を加え、書き方の警告と点検のずれにする項目を集める。 |
| [ライブラリ本体 / map / 読み取り](./MOD-472-27.yaml) | map の範囲の `flowchart`・`sequenceDiagram` の Mermaid と、補足の JSON のオブジェクトを読み取る。描画を止めず、読めない行と箇所を項目にして返す。 |
| [ライブラリ本体 / map / 配置](./MOD-472-28.yaml) | 構成図を、表示するノードとグループの集合を決めてから入れ子の内側から配置し、線の経路を引く。シーケンス図の表示する行を決める。 |
| [ライブラリ本体 / mermaid](./MOD-472-29.yaml) | `mount` が描いた mermaid のコードブロックを、mermaid で描いた SVG の図の枠に置き換える処理。描く先の CSS 変数から mermaid のテーマの変数を作り、配色の明暗が変わったら再描画する。ソースの読み取りと図の部品の HTML は DOM を使用せず、読み込みと描画はブラウザでだけ動く。 |
| [ライブラリ本体 / バージョンを上げる](./MOD-472-30.yaml) | `mdmark upgrade` の処理。バージョンの読み取りと比較、移行の手順の読み取り・検め・適用、コピーと戻し、変更履歴の行の抽き出し、標準入力での質問を持ち、`runUpgrade` がこれらと CLI の点検をつなぐ。 |
| [ライブラリ本体 / ビューとコメント](./MOD-472-31.yaml) | ビューとコメントの部品を `dist/index.js` と別の配布ファイル（`dist/view.js`・`dist/comments.js`）に分け、マーカーのある文書と `mountView`・`mountComments` を呼んだときにだけ読み込む処理と、その部品の HTML。ブラウザでだけ動く（部品の HTML と箇所の探し方は Node でも動く）。 |
| [ライブラリ本体 / ビルド](./MOD-472-32.yaml) | `npm run build` が実行するビルドのスクリプト。バージョンを決めて検査し、esbuild で `dist/` を書き込み、配布ファイルのサイズを検査する。Node.js v24 が型を削除して `node scripts/build.ts` で直接実行する。 |
| [ライブラリ本体 / 公開の入口](./MOD-472-33.yaml) | 配布物の入口の JavaScript と CSS。JavaScript は公開関数と公開の型を export し、CSS は描いた文書の外観を `@layer mdmark` に入れて持つ。 |
| [ライブラリ本体 / 図](./MOD-472-34.yaml) | 図の部品（グラフ・ER 図・操作できる部品）の定義の型と確認し、線の形状の計算、部品の HTML、記法のコアルール、`mount` が付ける拡大・縮小・移動・全画面・ツールチップ・写す操作。定義から HTML までは DOM を使用せず Node でも動き、操作はブラウザでだけ動く。 |
| [ライブラリ本体 / 差分](./MOD-472-35.yaml) | `mount` に指定した取り出し元から 2 つのリビジョンの本文を受け、行と単語を比べて描き、ミニマップでスクロールする処理と、描いた文書のブロックを追加と削除の色で塗り分ける処理と、その部品の HTML。ブラウザでだけ動く（部品の HTML と比較は Node でも動く）。 |
| [ライブラリ本体 / 拡張](./MOD-472-36.yaml) | 利用側が `registerExtension` で追加したマーカーの登録表と、引数を Standard Schema で検査して記載の警告の項目にする処理。登録表はページに 1 つで、`render` と `mount` が読み込む。 |
| [ライブラリ本体 / 描く](./MOD-472-37.yaml) | 利用側のページの要素に文書を描き、再描画と片付けを受け持つ処理。記法の操作を付け、文書のマーカーにある外部ライブラリと拡張のモジュールを読み込んでマーカーの場所に描かせ、色分けの対象のコードブロックを色分けし、印刷の前後で折り畳みと記法を開いて戻す。ブラウザでだけ動く（色分けの HTML を行に分ける `src/highlight-lines.ts` だけは DOM を使用せず、部品の描画のインターフェースも使用する）。 |
| [ライブラリ本体 / 描画](./MOD-472-38.yaml) | Markdown を本文の HTML 文字列にする処理。markdown-it で解析し、トークンの段階でマーカーを取得し GitHub Flavored Markdown の不足と画面設計の属性を追加し、sanitize-html で許可していない要素・属性・URL を落とす。DOM に頼らず、ブラウザと Node で同じ文字列を返却する。 |
| [ライブラリ本体 / 操作](./MOD-472-39.yaml) | `mount` が描いた記法に操作を付け、削除する処理。表の並べ替え・ピン止め・絞り込み、タブ、セクションと行の詳細の開閉、表の見出し行と集計の行を留める処理、コードブロックのコピー、右側の目次を受け持ち、付ける関数はどれも削除する関数を返却する。ブラウザでだけ動く。 |
| [ライブラリ本体 / 書き出したHTMLの起動](./MOD-472-40.yaml) | CLI が書き出した HTML に埋める起動の処理。ライブラリ本体と一緒に `dist/viewer.js` にまとめ、書き出しのときに CLI が埋めるモジュールと 1 つのスクリプトにまとめる。開いたときに埋めた中身を読み込んで、読み込み済みのモジュールを指定し、拡張を登録して `mount` で描く。まとめた HTML では URL の `#` で文書を行き来する。 |
| [ライブラリ本体 / 検査](./MOD-472-41.yaml) | ESLint の道具と設定（`tools/eslint/`）・検査の npm scripts と、テストの起動で Git のリポジトリの場所を指す環境変数を削除する処理。配布物には入らない。 |
| [ライブラリ本体 / 索引と用語](./MOD-472-42.yaml) | 索引の構造の検査・参照の表・索引の点検と、用語集の表の読み取り・用語と文書の別名の照合・ツールチップと関連文書の一覧の部品・ツールチップの操作。索引の処理は DOM に頼らず、Node とブラウザで同じ結果を返却する。 |
| [ライブラリ本体 / 記法](./MOD-472-43.yaml) | マーカーと記法を HTML にする markdown-it のコアルール。記法ごとに 1 ファイルで、トークンの並びを書き換え、部品の HTML を差し込む。機能がオフの記法は何もしない。読み込めない指定は記載の警告を差し込み、読み込めた指定で描く。 |
| [ライブラリ本体 / 設定と機能](./MOD-472-44.yaml) | 利用側が指定する設定に既定を適用する処理と、設定の `features` に文書の `features` のマーカーを重ねて機能のオン・オフを決める処理。どちらも DOM に頼らず、ブラウザと Node で動く。 |
| [ライブラリ本体 / 設定を重ねて読み込む](./MOD-472-45.yaml) | 端末の設定と、起点のフォルダから上のフォルダの `mdmark.config.yaml` を探して重ねる処理。CLI・MCP のツール・VS Code 拡張機能が同じ関数を呼ぶ。 |
| [ライブラリ本体 / 部品](./MOD-472-46.yaml) | 文書の中に mdmark が配置する UI の部品を HTML 文字列で返却する関数と、Storybook のストーリー。DOM に頼らず、ブラウザと Node で同じ出力になる。 |
| [ライブラリ本体 / 部品の描画](./MOD-472-47.yaml) | Storybook（`@storybook/react-vite`）のストーリーに部品の HTML を出す仕組み。部品の HTML を返却する描画のインターフェース（Node の HTTP サーバー）と、Storybook の設定・描画のインターフェースの HTML を描くデコレーター・VS Code の配色を与えるデコレーターを持つ。配布物には入らない。 |
| [ライブラリ本体 / 描画 / mark-options.ts](./MOD-477-1.ts.yaml) | ライブラリ本体 / 描画 / mark-options.ts |
| [ライブラリ本体 / 描画 / mark-schema.ts](./MOD-477-2.ts.yaml) | ライブラリ本体 / 描画 / mark-schema.ts |
| [ライブラリ本体 / 描画 / legacy-marks.ts](./MOD-477-3.ts.yaml) | ライブラリ本体 / 描画 / legacy-marks.ts |
| [ライブラリ本体 / バージョンを上げる / marker-json.mjs](./MOD-477-4.mjs.yaml) | ライブラリ本体 / バージョンを上げる / marker-json.mjs |
| [ライブラリ本体 / map / convert.ts](./MOD-477-5.ts.yaml) | ライブラリ本体 / map / convert.ts |
| [ライブラリ本体 / バージョンを上げる / retired-diagrams.mjs](./MOD-477-6.mjs.yaml) | ライブラリ本体 / バージョンを上げる / retired-diagrams.mjs |

<!-- /table -->
