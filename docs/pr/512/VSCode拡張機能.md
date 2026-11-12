# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-50.yaml](https://github.com/shuhei1101/mdmark/blob/0c7942ee/docs/scenario/SC-472-50.yaml) | 拡張機能の配布物を作る。タグで .vsix を GitHub Release に添える | Open VSX へ公開する流れと、公開に失敗したときの保証を加える |
| ドキュメント | [docs/interface/IF-472-23.ts.yaml](https://github.com/shuhei1101/mdmark/blob/0c7942ee/docs/interface/IF-472-23.ts.yaml) | 副作用が「Marketplace・Open VSX へは登録しない」、権限が `contents: write` だけ | 公開の工程・`id-token: write`・公開の失敗を加える |
| ドキュメント | [docs/module/MOD-472-83.yml.yaml](https://github.com/shuhei1101/mdmark/blob/0c7942ee/docs/module/MOD-472-83.yml.yaml)・[docs/module/MOD-472-17.yaml](https://github.com/shuhei1101/mdmark/blob/0c7942ee/docs/module/MOD-472-17.yaml) | ワークフロー `vscode-release.yml` の工程と `permissions` | 公開の工程と `id-token: write` を加える |
| ドキュメント | [docs/architecture/ARCH-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/0c7942ee/docs/architecture/ARCH-472-1.yaml) | 外部システムに GitHub Actions と GitHub Releases がある。Open VSX が無い | 外部システムに Open VSX を加え、リポジトリ構成の `.github/workflows/` の行を合わせる |
| ドキュメント | [docs/library/LIB-472-34.yaml](https://github.com/shuhei1101/mdmark/blob/0c7942ee/docs/library/LIB-472-34.yaml) | vsce（.vsix を作る） | 公開に使う ovsx の外部ライブラリの設計書を新しく作る |
| ドキュメント | [docs/dev-command/CMD-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/0c7942ee/docs/dev-command/CMD-472-1.yaml) | 拡張機能のタグを打つ手順。Release に .vsix を添えるまで | タグで Open VSX にも公開される旨を加える |
| ドキュメント | [docs/guide/VSCodeで確認する-プレビューを開く.md](https://github.com/shuhei1101/mdmark/blob/0c7942ee/docs/guide/VSCode%E3%81%A7%E7%A2%BA%E8%AA%8D%E3%81%99%E3%82%8B-%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.md) | Marketplace と Open VSX から入れる手順 | Open VSX はタグを打った版が届く旨に合わせる |
| 実装 | [.github/workflows/vscode-release.yml](https://github.com/shuhei1101/mdmark/blob/0c7942ee/.github/workflows/vscode-release.yml) | .vsix を作り Release に添える | Open VSX へ公開する工程を加える |
| テスト | [vscode/tests/integration/release.test.ts](https://github.com/shuhei1101/mdmark/blob/0c7942ee/vscode/tests/integration/release.test.ts) | ワークフローの `on.push.tags` と `permissions` を確かめる | 公開の工程と `id-token: write` を確かめる |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 公開の工程 | Release に添えた後、同じ .vsix を `ovsx publish {.vsix}` で Open VSX へ公開する | 認証の渡し方は PoC 検証で確かめる |
| 認証 | trusted publisher（OIDC）。`permissions` に `id-token: write` を加え、シークレットを使わない | 前提はユーザーの操作（所有権の申請 → Publisher Agreement の署名の確認 → 初回の手動の公開 → trusted publisher の登録。要件.md の `## 要望`） |
| 工程の並び | バージョンの比較 → 依存 → .vsix → Release に添える → Open VSX へ公開 | Release に添えてから公開し、公開の失敗で Release の .vsix を消さない |
| 異常系 | バージョンが合わないときは公開しない。公開済みのバージョン・認証の失敗はワークフローを失敗させ、ログに Open VSX の応答を出す | - |
| Marketplace | この PR では公開しない | 要件.md の `未確定` |
| 既存機能への影響 | GitHub Release に .vsix を添える工程は変えない | - |

## テスト結果

なし（テスト作成・実装で記入する）
