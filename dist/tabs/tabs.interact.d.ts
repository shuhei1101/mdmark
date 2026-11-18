/** 選んだタブ名を残す localStorage のキーの頭。キーは `{頭}{group}` */
export declare const TAB_CHOICE_KEY_PREFIX = "mdmark-tabs:";
/** localStorage に残したタブ名を読み込む。取り出しと読み込み出しで例外が出たら `console.warn` に出して `undefined` を返却する */
export declare function loadTabChoice(group: string): string | undefined;
/** 選んだタブ名を localStorage に残す。取り出しと書き込みで例外が出たら `console.warn` に出して続ける */
export declare function saveTabChoice(choice: {
    group: string;
    name: string;
}): void;
/** 要素を含む `role="tabpanel"` を外側から順にたどり、その中身のタブを選ぶ。選んだタブ名は残さず、同じ組のタブも統一しない。タブの中に無ければ何もしない */
export declare function revealTabTarget(target: Element): void;
/** 各 `mdmark-tabs` の頭にタブの並びを配置し、中身を `role="tabpanel"` にして 1 つ目（組を持つなら残したタブ名のタブ）を選ぶ。URL の `#ID` が選ばれていない中身の中を指すときは、残したタブ名より先にそのタブを選んで要素へ移る。タブの並びを取り除き、中身を `render` の構造に戻す関数を返却する */
export declare function attachTabs(root: HTMLElement): () => void;
