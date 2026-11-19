import { injectMarkerGuide } from "./marker-guide.ts";
import { renderReply } from "./reply.tsx";
import { renderUserMessage } from "./user-message.tsx";

/** Claude Code がフックの登録に指定する関数 */
type On = (event: string, ...rest: unknown[]) => void;

/** `ui.render` の `AssistantMessage`・`UserMessage` と `classic.SessionStart` に、各ファイルのフックを登録する。`claude plugin validate` は、ファイルの最上位で宣言した関数の `register` だけを読む */
export function register(on: On): void {
  on("ui.render", { component: "AssistantMessage" }, renderReply);
  on("ui.render", { component: "UserMessage" }, renderUserMessage);
  on("classic.SessionStart", injectMarkerGuide);
}
