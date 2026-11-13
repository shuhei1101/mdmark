import { type MarkOptions } from "./mark-options.ts";
/** 検証が参照する JSON Schema のキーワードだけを持つスキーマ */
export type MarkSchema = {
    $schema?: string;
    $id?: string;
    $defs?: Record<string, MarkSchema>;
    $ref?: string;
    title?: string;
    description?: string;
    type?: string;
    enum?: unknown[];
    const?: unknown;
    properties?: Record<string, MarkSchema>;
    required?: string[];
    additionalProperties?: boolean | MarkSchema;
    items?: MarkSchema;
    anyOf?: MarkSchema[];
    minimum?: number;
    maximum?: number;
    minLength?: number;
};
/** マーカーの設定の誤り 1 つ */
export type MarkProblem = {
    /** キーのパス（引数そのもののときは空） */
    path: string;
    /** 記載の警告の本文 */
    message: string;
};
/** 描くときは画面に出さず、点検だけがずれにする記法のマーカーの注記 1 つ */
export type MarkNote = {
    kind: "unknown_mark_arg" | "legacy_mark" | "mark_option_unapplied";
    message: string;
};
/** マーカーの名前から JSON Schema を参照する表 */
export declare const MARK_SCHEMAS: Readonly<Record<string, MarkSchema>>;
/** マーカーの設定を、マーカーの JSON Schema で確かめ、誤りの値と知らないキーを除いた設定を返却する。スキーマの無い名前は確かめない */
export declare const validateMarkOptions: (options: {
    name: string;
    options: MarkOptions;
}) => {
    options: MarkOptions;
    problems: MarkProblem[];
    unknownKeys: string[];
};
/** 描くときは画面に出さず点検だけがずれにする注記を作る */
export declare const markOptionNotes: (options: {
    name: string;
    source: "none" | "json" | "legacy" | "invalid";
    options: MarkOptions;
    unknownKeys: string[];
    isExtension: boolean;
}) => MarkNote[];
