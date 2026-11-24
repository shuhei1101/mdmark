# develop の配布物の再作成の失敗を検知してキャッシュを削除し、埋め込んだ動画に比率を保つリサイズハンドルを付ける

## 概要

develop の配布物の再作成が失敗したら放置されずに対応され、成功したら `@develop` を読み込む側に待たずに最新の配布物が返るようになる。
閲覧する人が、埋め込んだ動画の大きさを縦横の比率を保ったまま画面で変えられるようになる。

## 背景

束の親 [Issue #804](https://github.com/shuhei1101/mdmark/issues/804) の子 2 件の要望。

- [Issue #802](https://github.com/shuhei1101/mdmark/issues/802): workflow `develop-dist`（[.github/workflows/develop-dist.yml](https://github.com/shuhei1101/mdmark/blob/0605f6c8/.github/workflows/develop-dist.yml)）が 2026-11-23 から 4 回続けて失敗し、develop の `dist/` が 2 日間更新されなかった。最後の失敗は `dist/index.js` が配布ファイル 1 つの上限を超えたためで、上限を超える変更が作業 PR の時点で止まらずに develop へマージされた。成功した後も jsDelivr が `@develop` の更新前のファイルを 12 時間返した
- [Issue #803](https://github.com/shuhei1101/mdmark/issues/803): aituber の動画作成で MindStella の資料に段落で埋め込んだ動画が本文の幅いっぱいに出て、前後の文と一緒に見渡せない。部品『動画と音声』（[CMP-472-36](https://github.com/shuhei1101/mdmark/blob/0605f6c8/docs/component/CMP-472-36.ts.yaml)）には閲覧する人が大きさを変える操作が無く、図の枠のリサイズハンドル（[CMP-472-39](https://github.com/shuhei1101/mdmark/blob/0605f6c8/docs/component/CMP-472-39.ts.yaml)）は縦にだけ変えて動画は対象ではない。表のセルの中の動画をモーダルで再生する [#800](https://github.com/shuhei1101/mdmark/issues/800) は同じ部品を変えた

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理・未確定の論点・変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書（develop の配布物の再作成と、動画のリサイズハンドル） |
