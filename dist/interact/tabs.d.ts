/** 選んだタブ名を残す localStorage のキーの頭。キーは `{頭}{group}` */
export declare const TAB_CHOICE_KEY_PREFIX = "mdmark-tabs:";
/** localStorage に残したタブ名を読む。取り出しと読み出しで例外が出たら `console.warn` に出して `undefined` を返す */
export declare function loadTabChoice(group: string): string | undefined;
/** 選んだタブ名を localStorage に残す。取り出しと書き込みで例外が出たら `console.warn` に出して続ける */
export declare function saveTabChoice(choice: {
    group: string;
    name: string;
}): void;
/** 各 `mdmark-tabs` の頭にタブの並びを置き、中身を `role="tabpanel"` にして 1 つ目（組を持つなら残したタブ名のタブ）を選ぶ。タブの並びを取り除き、中身を `render` の形に戻す関数を返す */
export declare function attachTabs(root: HTMLElement): () => void;
