import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Environment, Interpreter, Template } from "@huggingface/jinja";
import { parse } from "yaml";

/** パッケージの直下からのプロンプトファイルのフォルダ */
export const PROMPTS_DIR = "content/prompts";

/** プロンプトファイルの部品 */
export type PromptPart = {
  id: string;
  when?: string;
  texts: { lang: string; text: string }[];
};

/** プロンプトファイル 1 枚を読み込んだ値 */
export type PromptFile = {
  id: string;
  kind: "instructions" | "tool";
  lang: string;
  vars?: Record<string, { required?: boolean; default?: unknown }>;
  parts: PromptPart[];
};

/** プロンプトファイルの読み込み・検査・描画の誤り。文にプロンプトの id と理由を含む */
export class PromptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptError";
  }
}

/** 構文木のノード */
type Node = Template["parsed"]["body"][number];

/** 子のノードを読むために、ノードを辞書として扱う */
type AnyNode = Node & Record<string, unknown>;

/** 使用する構文のノードの種類（変数・文字列・数・属性・length・比較・論理演算・if・for） */
const ALLOWED_NODE_TYPES = new Set([
  "Program",
  "Identifier",
  "StringLiteral",
  "IntegerLiteral",
  "MemberExpression",
  "FilterExpression",
  "BinaryExpression",
  "UnaryExpression",
  "If",
  "For",
]);

/** 本文の変数として扱わない組み込みの名前 */
const BUILTIN_NAMES = new Set(["true", "false", "none", "loop"]);

/** 使用するフィルタ */
const ALLOWED_FILTER = "length";

/** 構文木から、指定されていない変数の名前を集める。使用しない構文があれば誤りにする */
const collectUndefinedNames = (options: {
  program: Node;
  defined: ReadonlySet<string>;
  promptId: string;
}): string[] => {
  const { program, defined, promptId } = options;
  const missing = new Set<string>();
  const walk = (node: unknown, bound: ReadonlySet<string>): void => {
    if (node === undefined || node === null) {
      return;
    }
    const current = node as AnyNode;
    if (!ALLOWED_NODE_TYPES.has(current.type)) {
      throw new PromptError(
        `プロンプト ${promptId} に使用しない構文 ${current.type} があります`,
      );
    }
    const walkAll = (nodes: unknown, scope: ReadonlySet<string>) => {
      for (const child of nodes as unknown[]) {
        walk(child, scope);
      }
    };
    switch (current.type) {
      case "Program":
        walkAll(current.body, bound);
        return;
      case "Identifier": {
        const name = current.value as string;
        if (!bound.has(name) && !BUILTIN_NAMES.has(name) && !defined.has(name)) {
          missing.add(name);
        }
        return;
      }
      case "StringLiteral":
      case "IntegerLiteral":
        return;
      case "MemberExpression":
        walk(current.object, bound);
        if (current.computed === true) {
          walk(current.property, bound);
        }
        return;
      case "FilterExpression": {
        const filter = current.filter as AnyNode;
        if (filter.type !== "Identifier" || filter.value !== ALLOWED_FILTER) {
          throw new PromptError(
            `プロンプト ${promptId} に使用しないフィルタがあります（使用できるのは ${ALLOWED_FILTER} だけです）`,
          );
        }
        walk(current.operand, bound);
        return;
      }
      case "BinaryExpression":
        walk(current.left, bound);
        walk(current.right, bound);
        return;
      case "UnaryExpression":
        walk(current.argument, bound);
        return;
      case "If":
        walk(current.test, bound);
        walkAll(current.body, bound);
        walkAll(current.alternate, bound);
        return;
      case "For": {
        const loopvar = current.loopvar as AnyNode;
        if (loopvar.type !== "Identifier") {
          throw new PromptError(
            `プロンプト ${promptId} の for のループ変数は 1 つの名前にしてください`,
          );
        }
        walk(current.iterable, bound);
        walkAll(current.body, new Set([...bound, loopvar.value as string]));
        walkAll(current.defaultBlock, bound);
        return;
      }
    }
  };
  walk(program, new Set());
  return [...missing];
};

/** テンプレートを解析し、未定義の変数と使用しない構文を確かめる */
const parseChecked = (options: {
  source: string;
  defined: ReadonlySet<string>;
  promptId: string;
}): Template => {
  const { source, defined, promptId } = options;
  let template: Template;
  try {
    template = new Template(source);
  } catch (error) {
    throw new PromptError(
      `プロンプト ${promptId} の Jinja を解析できません: ${(error as Error).message}`,
    );
  }
  const missing = collectUndefinedNames({
    program: template.parsed,
    defined,
    promptId,
  });
  if (missing.length > 0) {
    throw new PromptError(
      `プロンプト ${promptId} に vars に無い変数があります: ${missing.join(", ")}`,
    );
  }
  return template;
};

/** 部品の使用条件 `when` を Jinja の真偽で評価する */
const evaluateWhen = (options: {
  when: string;
  values: Record<string, unknown>;
  promptId: string;
}): boolean => {
  const { when, values, promptId } = options;
  const template = parseChecked({
    source: when,
    defined: new Set(Object.keys(values)),
    promptId,
  });
  const body = template.parsed.body;
  const expression = body[0];
  if (body.length !== 1 || expression === undefined || expression.type === "If" || expression.type === "For") {
    throw new PromptError(
      `プロンプト ${promptId} の when は {{ 式 }} を 1 つだけにしてください: ${when}`,
    );
  }
  // 同じ Environment に同じ名前を 2 回登録できないため、評価ごとに作る
  const env = new Environment();
  for (const [name, value] of Object.entries({
    true: true,
    false: false,
    none: null,
    ...values,
  })) {
    env.set(name, value);
  }
  return new Interpreter(env).evaluate(expression, env).__bool__().value;
};

/** 値がオブジェクトか */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** `{root}/content/prompts/{id}.yaml` を読み込み、実行時に要る確認をして返却する */
export const loadPrompt = async (options: {
  root: string;
  id: string;
}): Promise<PromptFile> => {
  const { root, id } = options;
  const relative = `${PROMPTS_DIR}/${id}.yaml`;
  let raw: string;
  try {
    raw = await readFile(join(root, relative), "utf8");
  } catch (error) {
    throw new PromptError(
      `プロンプトファイル ${relative} を読み込めません: ${(error as Error).message}`,
    );
  }
  const value: unknown = parse(raw);
  if (!isRecord(value) || !Array.isArray(value.parts)) {
    throw new PromptError(`プロンプトファイル ${relative} に parts がありません`);
  }
  if (value.id !== id) {
    throw new PromptError(
      `プロンプトファイル ${relative} の id がパスと一致しません: ${String(value.id)}`,
    );
  }
  const prompt = value as PromptFile;
  for (const part of prompt.parts) {
    const langs = part.texts.map((text) => text.lang);
    if (!langs.includes(prompt.lang)) {
      throw new PromptError(
        `プロンプト ${id} の部品 ${part.id} に ${prompt.lang} の本文がありません`,
      );
    }
    if (new Set(langs).size !== langs.length) {
      throw new PromptError(
        `プロンプト ${id} の部品 ${part.id} で texts の言語が重なっています`,
      );
    }
  }
  return prompt;
};

/** 変数を指定して、`when` が真の部品の `lang` の本文を並び順につなぐ */
export const renderPrompt = (
  prompt: PromptFile,
  vars: Record<string, unknown>,
): string => {
  const definitions = prompt.vars ?? {};
  for (const [name, definition] of Object.entries(definitions)) {
    if (definition.required === true && !(name in vars)) {
      throw new PromptError(
        `プロンプト ${prompt.id} の必須の変数 ${name} が指定されていません`,
      );
    }
  }
  const values: Record<string, unknown> = {
    ...Object.fromEntries(
      Object.entries(definitions).map(([name, definition]) => [
        name,
        definition.default ?? null,
      ]),
    ),
    ...vars,
  };
  const defined = new Set(Object.keys(values));
  const rendered: string[] = [];
  for (const part of prompt.parts) {
    if (
      part.when !== undefined &&
      !evaluateWhen({ when: part.when, values, promptId: prompt.id })
    ) {
      continue;
    }
    const text = part.texts.find((item) => item.lang === prompt.lang)?.text;
    if (text === undefined) {
      throw new PromptError(
        `プロンプト ${prompt.id} の部品 ${part.id} に ${prompt.lang} の本文がありません`,
      );
    }
    const template = parseChecked({
      source: text,
      defined,
      promptId: prompt.id,
    });
    const output = template.render(values);
    // project-index の prompt-doc（keep_trailing_newline）と同じく、本文の末尾の改行を残す
    rendered.push(
      text.endsWith("\n") && !output.endsWith("\n") ? `${output}\n` : output,
    );
  }
  // project-index の prompt-doc と同じく、区切り無しでつないで末尾の改行を除く
  return rendered.join("").replace(/\n+$/, "");
};
