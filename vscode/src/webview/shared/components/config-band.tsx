import { TriangleAlert } from "lucide-react";
import {
  ALERT_ICON_CLASS,
  Alert,
  AlertDescription,
  AlertTitle,
} from "./ui/alert.tsx";
import { Button } from "./ui/button.tsx";

/** 設定ファイルを読めない帯の props */
export type ConfigBandProps = {
  /** 読めない設定ファイルのパス（ワークスペースの中はワークスペースのフォルダからの相対パス、外はホームを `~` にしたパス） */
  path: string;
  /** 読めない行（1 始まり） */
  line: number;
  /** 「設定ファイルを開く」を押したとき */
  onOpenConfig: () => void;
};

/** 文書の先頭に置く、設定ファイルを読めない帯と「設定ファイルを開く」。帯の幅が 30rem 以上ではボタンを文の右に置く */
export const ConfigBand = ({ path, line, onOpenConfig }: ConfigBandProps) => (
  <div className="mdmark-panel-part mdmark-config-band-frame @container px-3 pt-3">
    <Alert
      variant="warning"
      role="status"
      className="mdmark-config-band @band:grid-cols-alert-action"
    >
      <TriangleAlert aria-hidden="true" className={ALERT_ICON_CLASS} />
      <AlertTitle asChild className="text-base/6">
        <h2>設定ファイルを読み込めません</h2>
      </AlertTitle>
      <AlertDescription>
        <code>{path}</code> の {line} 行目を YAML として読めないため、
        この設定ファイルを重ねずに表示しています。
      </AlertDescription>
      <div className="col-start-2 mt-2 @band:col-start-3 @band:row-span-2 @band:row-start-1 @band:mt-0 @band:self-center">
        <Button
          variant="outline"
          data-action="openConfig"
          onClick={onOpenConfig}
        >
          設定ファイルを開く
        </Button>
      </div>
    </Alert>
  </div>
);
