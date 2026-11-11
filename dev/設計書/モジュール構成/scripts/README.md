# scripts

scripts の設計書

## 目次

<!-- table: data -->

| ページ | 概要 |
| --- | --- |
| [baseline.ts](./baseline.ts.yaml) | ライブラリ本体 / ビルド / baseline.ts |
| [build-plugin.ts](./build-plugin.ts.yaml) | 配布物のビルド（`scripts/build.ts`）から呼ばれ、ガイドの索引を検査してから、フックをまとめ、プラグインのバージョン・まとめた依存のライセンスを `plugin/` に書き込む。MCP サーバーとガイドはまとめない。 |
| [build.ts](./build.ts.yaml) | ライブラリ本体 / ビルド / build.ts |
| [bundle.ts](./bundle.ts.yaml) | ライブラリ本体 / ビルド / bundle.ts |
| [eslint.ts](./eslint.ts.yaml) | ライブラリ本体 / 検査 / eslint.ts |
| [mermaid-fixtures.ts](./mermaid-fixtures.ts.yaml) | ライブラリ本体 / 部品の描画 / mermaid-fixtures.ts |
| [migrations.ts](./migrations.ts.yaml) | ライブラリ本体 / ビルド / migrations.ts |
| [storybook-render.ts](./storybook-render.ts.yaml) | ライブラリ本体 / 部品の描画 / storybook-render.ts |

<!-- /table -->
