import { useEffect, useEffectEvent } from "react";
import { classifyLoadFailure, type Mdmark } from "../load-mdmark.ts";

/** 配布物を読み込み始めてからこのミリ秒が経っても描けていなければ読み込み中を出す */
export const LOADING_DELAY_MS = 1000;

/** `distJs` があれば配布物を読み込み、読み込めたら `onLoaded`、読み込めなければ理由を見分けて `onFailed`、`LOADING_DELAY_MS` 経ったら `onSlow` を呼ぶ */
export const useLoadMdmark = (options: {
  /** 読み込む配布物の URL。無ければ読み込まない */
  distJs: string | undefined;
  /** 配布物を読み込む関数 */
  load: (url: string) => Promise<Mdmark>;
  /** 読み込めたとき */
  onLoaded: (mdmark: Mdmark) => void;
  /** 読み込めなかったとき */
  onFailed: (reason: "offline" | "versionMissing") => void;
  /** `LOADING_DELAY_MS` 経ったとき */
  onSlow: () => void;
}): void => {
  const { distJs } = options;
  const load = useEffectEvent(options.load);
  const onLoaded = useEffectEvent(options.onLoaded);
  const onFailed = useEffectEvent(options.onFailed);
  const onSlow = useEffectEvent(options.onSlow);
  useEffect(() => {
    if (distJs === undefined) {
      return;
    }
    // 削除した後に届いた結果は捨てる
    let active = true;
    const timer = setTimeout(() => onSlow(), LOADING_DELAY_MS);
    load(distJs).then(
      (mdmark) => {
        if (active) {
          onLoaded(mdmark);
        }
      },
      async () => {
        const reason = await classifyLoadFailure({
          url: distJs,
          fetch: window.fetch.bind(window),
        });
        if (active) {
          onFailed(reason);
        }
      },
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [distJs]);
};
