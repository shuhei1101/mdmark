/** wide の範囲の HTML を返す。`toggle` のときは直前に帯と切り替えのボタンを置く */
export declare const renderWide: (options: {
    /** 範囲の中身の HTML（`SLOT_MARKER` を渡せる） */
    body: string;
    /** 広げた幅か本文の幅か */
    state: "wide" | "narrow";
    /** 切り替えのボタンの帯を置くか */
    toggle: boolean;
}) => string;
/** wide の範囲の上に置く、切り替えのボタンの帯の HTML を返す */
export declare const renderWideBar: (pressed: boolean) => string;
