# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-50.yaml](https://github.com/shuhei1101/mdmark/blob/0c7942ee/docs/scenario/SC-472-50.yaml) | 拡張機能の配布物を作る。タグで .vsix を GitHub Release に添える | Marketplace へ公開する流れと、公開に失敗したときの保証を加える |
| ドキュメント | [docs/interface/IF-472-23.ts.yaml](https://github.com/shuhei1101/mdmark/blob/0c7942ee/docs/interface/IF-472-23.ts.yaml) | 副作用が「Marketplace・Open VSX へは登録しない」、権限が `contents: write` だけ | 副作用を Marketplace への公開に変え、`id-token: write`・公開の失敗を加える |
| ドキュメント | [docs/module/MOD-472-83.yml.yaml](https://github.com/shuhei1101/mdmark/blob/0c7942ee/docs/module/MOD-472-83.yml.yaml)・[docs/module/MOD-472-17.yaml](https://github.com/shuhei1101/mdmark/blob/0c7942ee/docs/module/MOD-472-17.yaml) | ワークフロー `vscode-release.yml` の工程と `permissions` | 公開の工程と `id-token: write` を加える |
| ドキュメント | [docs/architecture/ARCH-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/0c7942ee/docs/architecture/ARCH-472-1.yaml) | 外部システムに GitHub Actions と GitHub Releases がある。Marketplace が無い | 外部システムに Marketplace（trusted publishing）を加え、リポジトリ構成の `vscode/`・`.github/workflows/` の行を合わせる |
| ドキュメント | [docs/library/LIB-472-34.yaml](https://github.com/shuhei1101/mdmark/blob/0c7942ee/docs/library/LIB-472-34.yaml) | vsce（.vsix を作る）。`vscode/package.json` で 4.0.0 に固定 | バージョンを 4.1.1 に上げ、`publish --oidc` の用途と確認結果を加える |
| ドキュメント | [docs/dev-command/CMD-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/0c7942ee/docs/dev-command/CMD-472-1.yaml) | 拡張機能のタグを打つ手順。Release に .vsix を添えるまで | タグで Marketplace にも公開される旨を加える |
| ドキュメント | [docs/guide/VSCodeで確認する-プレビューを開く.md](https://github.com/shuhei1101/mdmark/blob/0c7942ee/docs/guide/VSCode%E3%81%A7%E7%A2%BA%E8%AA%8D%E3%81%99%E3%82%8B-%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.md) | Marketplace と Open VSX から入れる手順 | Marketplace にはタグを打ったバージョンが届く旨に合わせ、Open VSX の記述を削除する |
| 実装 | [.github/workflows/vscode-release.yml](https://github.com/shuhei1101/mdmark/blob/0c7942ee/.github/workflows/vscode-release.yml) | .vsix を作り Release に添える | Marketplace へ公開する工程を加える |
| テスト | [vscode/tests/integration/release.test.ts](https://github.com/shuhei1101/mdmark/blob/0c7942ee/vscode/tests/integration/release.test.ts) | ワークフローの `on.push.tags` と `permissions` を確かめる | 公開の工程と `id-token: write` を確かめる |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 公開の工程 | Release に添えた後、同じ .vsix を `vsce publish --oidc --packagePath {.vsix}` で Marketplace へ公開する | - |
| vsce のバージョン | `vscode/package.json` の devDependencies の `@vscode/vsce` を 4.0.0 から 4.1.1 に上げ、`package-lock.json` を更新する | 4.0.0 の OIDC のトークン交換は Marketplace の仕様と合わない（api-version なし・`Bearer`）。v4.1.0 の「oidc: align token exchange with the Marketplace contract」で `FederatedToken` に修正された |
| 拡張機能のバージョン | `vscode/package.json` の `version` を `0.1.0` から `0.1.3` に上げる | Marketplace の公開済みの最新は `0.1.2`（ワークフローの外で公開。確認ログ） |
| 認証 | Marketplace の trusted publishing（OIDC）。`permissions` に `id-token: write` を加え、シークレットを使用しない | ポリシーはユーザーが登録済み（要件.md の `## 要望`） |
| 工程の並び | バージョンの比較 → 依存（リポジトリの直下の `npm ci` と `npm --prefix vscode ci`）→ .vsix → Release に添える → Marketplace へ公開 | Release に添えてから公開し、公開の失敗で Release の .vsix を消さない |
| 異常系 | バージョンが合わないときは公開しない。公開済みのバージョンは vsce がアップロードの前に `{publisher}.{name} v{バージョン} already exists.` で止め、ワークフローを失敗させる。認証の失敗は交換の応答（`Marketplace OIDC token exchange failed with {status}: {message}`）でワークフローを失敗させる | `--skip-duplicate` は付けない |
| Open VSX | 公開しない | 要件.md の `## 要望` |
| 既存機能への影響 | GitHub Release に .vsix を添える工程は変えない | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `18dac2d4..3654df79` | 拡張機能の配布物を作る（`18dac2d4` は develop の取り込み） |
| 単一ユースケース設計 | `3db93260..8b047397` | レビューの指摘の修正（公開済みのバージョンの異常シナリオ） |
| インターフェース定義設計 | `d113c3e9..f2918a3f` | 拡張機能の配布物を作る。シナリオの `test` の名前・拡張機能のバージョンの方針も合わせた |
| モジュール構成設計 | `5c0bcd92..8be9ccc9` | vscode-release.yml・ビルドと配布 |
| インターフェース定義設計・モジュール構成設計 | `911a7249..1e8e94a9` | 実装で判明した、.vsix を作る前にリポジトリの直下の依存を入れる工程を追加 |
| 単一ユースケース設計・インターフェース定義設計 | `5afa346e..7665a8e4` | 例のバージョンを 0.1.3 に変更（Marketplace に 0.1.2 が公開済み。確認ログ） |

## PoC 結果

| 検証構成 | 成功条件 | 結果 | PoC PR | 補足 |
| --- | --- | --- | --- | --- |
| PoC ブランチへの push で `vscode-release.yml`（`id-token: write`）を動かし、`npm --prefix vscode ci` で入れた vsce 4.1.1 の `getOIDCCredential('ShuheiNishikawa')` で交換する | 例外なく返り、トークンの長さが 1 以上、終了コード 0 | ✅ 長さ 942 | [#555](https://github.com/shuhei1101/mdmark/pull/555)（closed） | [run 43542400400](https://github.com/shuhei1101/mdmark/actions/runs/43542400400) |
| 同上 | workflow が `secrets.*` を参照しない | ✅ 参照なし | 同上 | - |
| 同上 | PoC の後も Marketplace のバージョンが 0.1.0・0.1.1 のまま | ✅ 0.1.0・0.1.1 | 同上 | - |

成立。登録したポリシー（Workflow `vscode-release.yml`・Environment なし）は、タグではなくブランチへの push の実行でも交換を許した。本番の `vsce publish --oidc` は同じ `getOIDCCredential` で得たトークンで公開する。

最小再現コードの要点（PoC PR の `.github/workflows/vscode-release.yml`）:

```yaml
permissions:
  contents: read
  id-token: write
jobs:
  exchange:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm --prefix vscode ci --ignore-scripts
      - run: |
          node -e "
          require('./vscode/node_modules/@vscode/vsce/out/oidc.js')
            .getOIDCCredential('ShuheiNishikawa')
            .then(c => console.log('Marketplace credential issued, length=' + c.length))
            .catch(e => { console.error(e.message); process.exit(1); });
          "
```

diff の見どころ: `vscode/package.json` の `@vscode/vsce` を 4.1.1 に上げた行と、`permissions` の `id-token: write`。

## テスト結果

ドキュメント修正（`d843f41a`。アーキテクチャ図・開発コマンド・ガイド・非機能要件）: 文書だけの変更で、規約『V字モデル』の対応表で関係する単体・結合テストが無いため実行していない。

### 単体

なし。実装（`bb11edbe`）はワークフローの YAML と `vscode/package.json`・`package-lock.json` だけを変え、規約『V字モデル』の対応表で対応する単体テストが無い。

### lint

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `npm run lint`・`npm run lint:eslint`・`npm run typecheck`・`npm --prefix vscode run typecheck` | 全実行 | 実行のみ | ✅ | `テスト結果/20261114132814_37ca2837_lint.log`（直下の依存を確認する結合テストの追加の後。前回は `テスト結果/20261114125608_d79a9dfb_lint.log`） |

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [vscode/tests/integration/release.test.ts](https://github.com/shuhei1101/mdmark/blob/d79a9dfb/vscode/tests/integration/release.test.ts) | `test_normal`・`test_error_when_version_mismatch` | 変更 | ✅ | 0.1.3・`id-token: write`・最後の公開の工程（Release に添える工程より後・`--skip-duplicate` なし）・`secrets.` を含まないことを追加<br>`テスト結果/20261114124650_d79a9dfb_VSCode拡張機能の結合テスト.log` |
| `vscode/tests/integration/*.test.ts`（上記以外） | 全実行 | 実行のみ | ✅ | VS Code 1.141.0 と stable の両方で 83 passing<br>`テスト結果/20261114124650_d79a9dfb_VSCode拡張機能の結合テスト.log` |

| [vscode/tests/integration/release.test.ts](https://github.com/shuhei1101/mdmark/blob/37ca2837/vscode/tests/integration/release.test.ts) | `test_normal` | 変更 | ✅ | レビューの任意の指摘で、リポジトリの直下の `npm ci` が `npm --prefix vscode run package` より前にあることの確認を追加。37ca2837 で 2 回実行し、2 回とも両方のバージョンで pass<br>`テスト結果/20261114130458_37ca2837_VSCode拡張機能の結合テスト.log`・`テスト結果/20261114131254_37ca2837_VSCode拡張機能の結合テスト.log` |

37ca2837 の 2 回の実行では、この PR が触れていない既知の不安定なテストが 1 件ずつ fail した（1 回目は stable の `preview-rerender.test.ts` の `test_normal_when_map_configured`（#535）、2 回目は stable の `preview-open.test.ts` の `test_normal_when_version_pinned`（#563））。`拡張機能の配布物を作る` の 2 件は全ての実行で pass し、その他の fail はどちらもこの PR の変更（ワークフロー・`vscode/package.json`・`release.test.ts`）に関わらないため、実行し直しを止めた。

d79a9dfb の 1 回目の実行では、この PR が触れていない `preview-open.test.ts` の `test_normal_when_version_pinned` が 1 件 fail した（`map.js` の要求が検証の時点で記録されていなかった）。テストコードも実装も変えずに実行し直して全 pass したため、`map.js` の読み込みと検証のタイミングによる不安定な fail と判断した。
