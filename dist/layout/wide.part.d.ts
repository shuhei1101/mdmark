/** wide の範囲の HTML を返却する。`toggle` のときは直前に帯と切り替えのボタンを配置する */
export declare const renderWide: (options: {
    /** 範囲の中身の HTML（`SLOT_MARKER` を指定できる） */
    body: string;
    /** 広げた幅か本文の幅か */
    state: "wide" | "narrow";
    /** 切り替えのボタンの帯を配置するか */
    toggle: boolean;
}) => string;
/** wide の範囲の上に配置する、切り替えのボタンの帯の HTML を返却する */
export declare const renderWideBar: (pressed: boolean) => string;
