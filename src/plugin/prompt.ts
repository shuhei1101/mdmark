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

/** 本文の変数として扱わない組み込みの名前 */
const BUILTIN_NAMES = new Set(["true", "false", "none", "loop"]);

/** 使用するフィルタ */
const ALLOWED_FILTER = "length";

/** たどるノードと、その中で使用できるループ変数 */
type Visit = { node: unknown; scope: ReadonlySet<string> };

/** ノードの子と、子の中で使用できるループ変数を返却する */
type ChildrenOf = (
  node: AnyNode,
  scope: ReadonlySet<string>,
  promptId: string,
) => Visit[];

/** ノードの並びを、同じループ変数でたどる子にする */
const visitAll = (nodes: unknown, scope: ReadonlySet<string>): Visit[] =>
  (nodes as unknown[]).map((node) => ({ node, scope }));

/** フィルタが `length` か確かめる */
const assertFilter = (node: AnyNode, promptId: string): void => {
  const filter = node.filter as AnyNode;
  if (filter.type !== "Identifier" || filter.value !== ALLOWED_FILTER) {
    throw new PromptError(
      `プロンプト ${promptId} に使用しないフィルタがあります（使用できるのは ${ALLOWED_FILTER} だけです）`,
    );
  }
};

/** for のループ変数の名前を返却する */
const loopVariable = (node: AnyNode, promptId: string): string => {
  const loopvar = node.loopvar as AnyNode;
  if (loopvar.type !== "Identifier") {
    throw new PromptError(
      `プロンプト ${promptId} の for のループ変数は 1 つの名前にしてください`,
    );
  }
  return loopvar.value as string;
};

/** 使用する構文（変数・文字列・数・属性・length・比較・論理演算・if・for）のノードの子 */
const CHILDREN_OF: Record<string, ChildrenOf> = {
  Program: (node, scope) => visitAll(node.body, scope),
  Identifier: () => [],
  StringLiteral: () => [],
  IntegerLiteral: () => [],
  MemberExpression: (node, scope) => [
    { node: node.object, scope },
    ...(node.computed === true ? [{ node: node.property, scope }] : []),
  ],
  FilterExpression: (node, scope, promptId) => {
    assertFilter(node, promptId);
    return [{ node: node.operand, scope }];
  },
  BinaryExpression: (node, scope) => [
    { node: node.left, scope },
    { node: node.right, scope },
  ],
  UnaryExpression: (node, scope) => [{ node: node.argument, scope }],
  If: (node, scope) => [
    { node: node.test, scope },
    ...visitAll(node.body, scope),
    ...visitAll(node.alternate, scope),
  ],
  For: (node, scope, promptId) => [
    { node: node.iterable, scope },
    ...visitAll(node.body, new Set([...scope, loopVariable(node, promptId)])),
    ...visitAll(node.defaultBlock, scope),
  ],
};

/** 構文木から、指定されていない変数の名前を集める。使用しない構文があれば誤りにする */
const collectUndefinedNames = (options: {
  program: Node;
  defined: ReadonlySet<string>;
  promptId: string;
}): string[] => {
  const { program, defined, promptId } = options;
  const missing = new Set<string>();
  const pending: Visit[] = [{ node: program, scope: new Set() }];
  for (let visit = pending.pop(); visit !== undefined; visit = pending.pop()) {
    const node = visit.node as AnyNode;
    const childrenOf = CHILDREN_OF[node.type];
    if (childrenOf === undefined) {
      throw new PromptError(
        `プロンプト ${promptId} に使用しない構文 ${node.type} があります`,
      );
    }
    const name =
      node.type === "Identifier" ? (node.value as string) : undefined;
    if (
      name !== undefined &&
      !visit.scope.has(name) &&
      !BUILTIN_NAMES.has(name) &&
      !defined.has(name)
    ) {
      missing.add(name);
    }
    pending.push(...childrenOf(node, visit.scope, promptId));
  }
  return [...missing].sort();
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
  if (
    body.length !== 1 ||
    expression === undefined ||
    expression.type === "If" ||
    expression.type === "For"
  ) {
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
    throw new PromptError(
      `プロンプトファイル ${relative} に parts がありません`,
    );
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

/** 必須の変数を確かめ、指定されていない任意の変数を既定値（無ければ null）で埋める */
const fillValues = (
  prompt: PromptFile,
  vars: Record<string, unknown>,
): Record<string, unknown> => {
  const definitions = Object.entries(prompt.vars ?? {});
  const missing = definitions.find(
    ([name, definition]) => definition.required === true && !(name in vars),
  );
  if (missing !== undefined) {
    throw new PromptError(
      `プロンプト ${prompt.id} の必須の変数 ${missing[0]} が指定されていません`,
    );
  }
  return {
    ...Object.fromEntries(
      definitions.map(([name, definition]) => [
        name,
        definition.default ?? null,
      ]),
    ),
    ...vars,
  };
};

/** 部品 1 つの `lang` の本文を描く。本文の末尾の改行は残す（project-index の prompt-doc の keep_trailing_newline と同じ） */
const renderPart = (options: {
  prompt: PromptFile;
  part: PromptPart;
  values: Record<string, unknown>;
}): string => {
  const { prompt, part, values } = options;
  const text = part.texts.find((item) => item.lang === prompt.lang)?.text;
  if (text === undefined) {
    throw new PromptError(
      `プロンプト ${prompt.id} の部品 ${part.id} に ${prompt.lang} の本文がありません`,
    );
  }
  const output = parseChecked({
    source: text,
    defined: new Set(Object.keys(values)),
    promptId: prompt.id,
  }).render(values);
  return text.endsWith("\n") && !output.endsWith("\n") ? `${output}\n` : output;
};

/** 変数を指定して、`when` が真の部品の `lang` の本文を並び順につなぐ */
export const renderPrompt = (
  prompt: PromptFile,
  vars: Record<string, unknown>,
): string => {
  const values = fillValues(prompt, vars);
  const rendered = prompt.parts
    .filter(
      (part) =>
        part.when === undefined ||
        evaluateWhen({ when: part.when, values, promptId: prompt.id }),
    )
    .map((part) => renderPart({ prompt, part, values }));
  // project-index の prompt-doc と同じく、区切り無しでつないで末尾の改行を除く
  return rendered.join("").replace(/\n+$/, "");
};
