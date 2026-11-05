import { Alert, AlertDescription, AlertTitle } from "./ui/alert.tsx";
import { Button } from "./ui/button.tsx";

export type StatusState = "loading" | "offline" | "versionUndecidable";

const REASONS = {
  offline: "mdmark を jsDelivr から読み込めませんでした。ネットワークにつながっているかを確かめてから、リロードしてください。",
  versionUndecidable:
    "読む mdmark のバージョンを決められませんでした。ネットワークにつながっているかを確かめてから、リロードしてください。",
} as const satisfies Record<Exclude<StatusState, "loading">, string>;

/** 読み込み中か、描けない理由と「リロード」 */
export const PreviewStatus = ({
  state,
  version,
  onReload,
}: {
  state: StatusState;
  version: string | undefined;
  onReload: () => void;
}) => {
  if (state === "loading") {
    return (
      <div className="mdmark-panel-part p-6">
        <Alert>
          <AlertTitle>mdmark を読み込んでいます</AlertTitle>
        </Alert>
      </div>
    );
  }
  return (
    <div className="mdmark-panel-part p-6">
      <Alert>
        <AlertTitle>プレビューを表示できません</AlertTitle>
        <AlertDescription>
          {REASONS[state]}
          {version === undefined ? null : `（${version}）`}
        </AlertDescription>
        <div>
          <Button type="button" onClick={onReload}>
            リロード
          </Button>
        </div>
      </Alert>
    </div>
  );
};
