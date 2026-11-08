import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import {
  ALERT_ICON_CLASS,
  Alert,
  AlertDescription,
  AlertTitle,
} from "./ui/alert.tsx";
import { Button } from "./ui/button.tsx";
import { Spinner } from "./ui/spinner.tsx";

/** 出す状態 */
export type PreviewStatusState =
  | "loading"
  | "offline"
  | "versionMissing"
  | "versionUndecidable"
  | "diffUnsupported"
  | "unexpected";

/** プレビューの状態の表示の props */
export type PreviewStatusProps = {
  /** 出す状態 */
  state: PreviewStatusState;
  /** 読み込もうとした mdmark のバージョン（`offline`・`versionMissing`・`diffUnsupported` の理由に入れる） */
  version?: string;
  /** 「リロード」を押したとき */
  onReload: () => void;
};

/** 描けない理由の本文 */
const reasonOf = (
  state: Exclude<PreviewStatusState, "loading">,
  version: string,
): ReactNode => {
  switch (state) {
    case "offline":
      return (
        <>
          mdmark（<code>{version}</code>）を jsDelivr
          から読み込めませんでした。ネットワークにつながっているかを確認してから、リロードしてください。
        </>
      );
    case "diffUnsupported":
      return (
        <>
          読み込んだ mdmark（<code>{version}</code>
          ）は差分の表示に対応していません。設定 <code>mdmark.version</code>{" "}
          を差分の表示に対応したバージョンか <code>latest</code>{" "}
          に変更してから、リロードしてください。
        </>
      );
    case "versionMissing":
      return (
        <>
          設定 <code>mdmark.version</code> に指定したバージョン{" "}
          <code>{version}</code> の mdmark
          が見つかりませんでした。存在するバージョンか <code>latest</code>{" "}
          に修正してから、リロードしてください。
        </>
      );
    case "versionUndecidable":
      return "読み込む mdmark のバージョンを決められませんでした。GitHub から最新のバージョンを取得できず、前回のバージョンも残っていません。ネットワークにつながっているかを確認してから、リロードしてください。";
    case "unexpected":
      return "プレビューの表示中にエラーが発生しました。リロードしてください。";
    default: {
      const unknown: never = state;
      throw new Error(`知らない状態: ${String(unknown)}`);
    }
  }
};

/** 文書の代わりに出す、読み込み中か描けない理由と「リロード」 */
export const PreviewStatus = ({
  state,
  version,
  onReload,
}: PreviewStatusProps) => (
  <div className="mdmark-panel-part mdmark-preview-status grid justify-items-center px-4 pt-panel-state pb-6">
    {state === "loading" ? (
      <div
        className="mdmark-preview-loading flex items-center gap-3 text-sm text-muted-foreground"
        role="status"
      >
        <Spinner />
        <h1 className="m-0 text-sm font-normal">mdmark を読み込んでいます</h1>
      </div>
    ) : (
      <Alert
        variant="warning"
        role="status"
        className="mdmark-preview-notice max-w-lg"
      >
        <TriangleAlert aria-hidden="true" className={ALERT_ICON_CLASS} />
        <AlertTitle asChild className="text-xl/7">
          <h1>プレビューを表示できません</h1>
        </AlertTitle>
        <AlertDescription>{reasonOf(state, version ?? "")}</AlertDescription>
        <div className="col-start-2 mt-2">
          <Button data-action="reload" onClick={onReload}>
            リロード
          </Button>
        </div>
      </Alert>
    )}
  </div>
);
