import { execFile } from "node:child_process";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import {
  type Document,
  isMap,
  isScalar,
  isSeq,
  parse,
  parseDocument,
} from "yaml";
import { CliError } from "./main.ts";
import { compareVersions, VERSION_PATTERN } from "./versions.ts";

/** 移行の手順の置き場所と、その中の名前 */
export const MIGRATIONS_DIR = {
  root: "migrations",
  next: "next",
  steps: "steps.yaml",
  noSteps: "no-steps.yaml",
} as const;

/** `call` のスクリプトに許す拡張子（`node_modules` の下で流せるものだけ） */
export const SCRIPT_EXTENSIONS = [".js", ".mjs"];

/** 手順が書き換える YAML: `config` は設定ファイル、`index` は設定の `index` が指す索引 */
export type StepFile = "config" | "index";

/** `call` のスクリプトが書き換えうるもの */
export type CallFile = StepFile | "documents";

/** 手順に共通のプロパティ */
type StepBase = {
  /** 何をどう変えるかの 1 文 */
  description: string;
  /** 当てると値が失われる手順か */
  destructive?: boolean;
};

/** キーの名前を変える手順 */
export type RenameKeyStep = StepBase & {
  op: "rename_key";
  file: StepFile;
  /** 元のキーのパス（`.` でつなぐ） */
  from: string;
  /** 新しいキーのパス */
  to: string;
};

/** 無いキーを足す手順 */
export type SetDefaultStep = StepBase & {
  op: "set_default";
  file: StepFile;
  key: string;
  /** 足す値。`ask` とどちらか 1 つ */
  value?: unknown;
  /** 利用者に値を聞く問いの文 */
  ask?: string;
};

/** 値を読み替える手順 */
export type MapValuesStep = StepBase & {
  op: "map_values";
  file: StepFile;
  key: string;
  /** 元の値から新しい値への表 */
  mapping: Record<string, unknown>;
};

/** 文書の印を書き換える手順 */
export type ReplaceMarkStep = StepBase & {
  op: "replace_mark";
  /** 書き換える前の印 */
  from: string;
  /** 書き換えた後の印 */
  to: string;
};

/** スクリプトで当てる手順 */
export type CallStep = StepBase & {
  op: "call";
  /** `steps.yaml` のあるフォルダからのスクリプトのパス */
  script: string;
  files: CallFile[];
};

/** `steps.yaml` の `steps` の要素 1 つ */
export type MigrationStep =
  | RenameKeyStep
  | SetDefaultStep
  | MapValuesStep
  | ReplaceMarkStep
  | CallStep;

/** 当てる 1 つの版と、その版の検めた手順 */
export type MigrationVersion = {
  /** 版（`v{MAJOR}.{MINOR}.{PATCH}`） */
  version: string;
  /** その版のフォルダの絶対パス（`call` のスクリプトの基準） */
  dir: string;
  /** 書いた順の手順 */
  steps: MigrationStep[];
};

/** 手順を当てる設定・索引・文書の場所と、当てる前に聞いた答え */
export type MigrationTarget = {
  /** 設定ファイルの絶対パス */
  configPath: string;
  /** 設定の `index` が指す索引の絶対パス。設定に `index` が無ければ `undefined` */
  indexPath: string | undefined;
  /** `build` の対象と索引の文書の絶対パス（重なりなし） */
  documents: string[];
  /** `ask` を持つ `set_default` に答えた値 */
  answers: Map<MigrationStep, string>;
};

const execFileAsync = promisify(execFile);

/** 手順の種類ごとに持てるプロパティ（共通の `op`・`description`・`destructive` のほか） */
const STEP_KEYS = {
  rename_key: ["file", "from", "to"],
  set_default: ["file", "key", "value", "ask"],
  map_values: ["file", "key", "mapping"],
  replace_mark: ["from", "to"],
  call: ["script", "files"],
} as const;

/** 手順の共通のプロパティ */
const COMMON_KEYS = ["op", "description", "destructive"];

/** `file` に書ける値 */
const STEP_FILES: string[] = ["config", "index"];

/** `files` に書ける値 */
const CALL_FILES: string[] = ["config", "index", "documents"];

/** 値が連想配列（`null`・配列を除くオブジェクト）か */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 失敗の理由を 1 行の文字にする */
function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0] ?? "";
}

/** 空でない文字列か */
function isFilled(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

/** 手順 1 つの形を検め、合わないところを `problem` に渡す */
function validateStep(
  item: unknown,
  where: string,
  problem: (where: string, message: string) => void,
): void {
  if (!isRecord(item)) {
    problem(where, "手順はキーと値で書いてください。");
    return;
  }
  const op = item.op;
  if (typeof op !== "string" || !(op in STEP_KEYS)) {
    problem(
      `${where}.op`,
      "op は rename_key・set_default・map_values・replace_mark・call のどれかで書いてください。",
    );
    return;
  }
  const kind = op as keyof typeof STEP_KEYS;
  if (!isFilled(item.description)) {
    problem(
      `${where}.description`,
      "description は空でない文字列で書いてください。",
    );
  }
  if (item.destructive !== undefined && typeof item.destructive !== "boolean") {
    problem(
      `${where}.destructive`,
      "destructive は true か false で書いてください。",
    );
  }
  const allowed: string[] = [...COMMON_KEYS, ...STEP_KEYS[kind]];
  for (const key of Object.keys(item)) {
    if (!allowed.includes(key)) {
      problem(`${where}.${key}`, `${op} が持たないキーです。消してください。`);
    }
  }
  /** 空でない文字列の必須のプロパティを検める */
  const requireString = (key: string) => {
    if (!isFilled(item[key])) {
      problem(`${where}.${key}`, `${key} は空でない文字列で書いてください。`);
    }
  };
  /** `file` が設定か索引を指すことを検める */
  const requireStepFile = () => {
    if (typeof item.file !== "string" || !STEP_FILES.includes(item.file)) {
      problem(`${where}.file`, "file は config か index で書いてください。");
    }
  };
  switch (kind) {
    case "rename_key":
      requireStepFile();
      requireString("from");
      requireString("to");
      break;
    case "set_default": {
      requireStepFile();
      requireString("key");
      const hasValue = "value" in item;
      const hasAsk = item.ask !== undefined;
      if (hasValue === hasAsk) {
        problem(
          `${where}.value`,
          "value か ask のどちらか 1 つだけを書いてください。",
        );
      }
      if (hasAsk) {
        requireString("ask");
      }
      break;
    }
    case "map_values": {
      requireStepFile();
      requireString("key");
      const mapping = item.mapping;
      if (!isRecord(mapping)) {
        problem(
          `${where}.mapping`,
          "mapping は元の値と新しい値の表で書いてください。",
        );
        break;
      }
      for (const [from, to] of Object.entries(mapping)) {
        // 新しい値が元の値にあると、当て直すたびに値が変わる
        if (typeof to === "string" && Object.hasOwn(mapping, to)) {
          problem(
            `${where}.mapping`,
            `${from} の新しい値 ${to} が元の値にもあります。当て直しても変わらないよう、新しい値は元の値にしないでください。`,
          );
        }
      }
      break;
    }
    case "replace_mark":
      requireString("from");
      requireString("to");
      if (
        isFilled(item.from) &&
        isFilled(item.to) &&
        item.to.includes(item.from)
      ) {
        problem(
          `${where}.to`,
          "to が from を含みます。当て直しても変わらないよう、to は from を含まないようにしてください。",
        );
      }
      break;
    case "call": {
      requireString("script");
      if (
        isFilled(item.script) &&
        !SCRIPT_EXTENSIONS.some((extension) =>
          (item.script as string).endsWith(extension),
        )
      ) {
        problem(
          `${where}.script`,
          `script の拡張子は ${SCRIPT_EXTENSIONS.join(" か ")} で書いてください。TypeScript は JavaScript にしたものを置きます。`,
        );
      }
      const files = item.files;
      if (
        !Array.isArray(files) ||
        files.length === 0 ||
        !files.every(
          (file) => typeof file === "string" && CALL_FILES.includes(file),
        )
      ) {
        problem(
          `${where}.files`,
          "files は config・index・documents のうち 1 つ以上の並びで書いてください。",
        );
      }
      break;
    }
  }
}

/** 読んだ `steps.yaml` を `schemas/mdmark.steps.schema.json` と同じ形で検め、形の合う手順と、合わないところ 1 つ 1 文を返す */
export function validateSteps(
  raw: unknown,
  file: string,
): { steps: MigrationStep[]; problems: string[] } {
  const problems: string[] = [];
  const problem = (where: string, message: string) => {
    problems.push(`${file}: ${where}: ${message}`);
  };
  if (!isRecord(raw)) {
    problem("steps", "steps の並びを書いてください。");
    return { steps: [], problems };
  }
  for (const key of Object.keys(raw)) {
    if (key !== "steps") {
      problem(key, "steps 以外のキーは書けません。消してください。");
    }
  }
  const steps = raw.steps;
  if (!Array.isArray(steps)) {
    problem("steps", "steps は手順の並びで書いてください。");
    return { steps: [], problems };
  }
  for (const [index, item] of steps.entries()) {
    validateStep(item, `steps[${index}]`, problem);
  }
  return {
    steps: problems.length === 0 ? (steps as MigrationStep[]) : [],
    problems,
  };
}

/** パスがファイルとして在るか */
async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** 版のフォルダの `steps.yaml` を読んで形を検め、`call` のスクリプトが版のフォルダの中にあることを確かめる。`label` は合わないところに出すファイルの名前 */
export async function readStepsFile(
  dir: string,
  label: string,
): Promise<{ steps: MigrationStep[]; problems: string[] }> {
  let raw: unknown;
  try {
    raw = parse(await readFile(join(dir, MIGRATIONS_DIR.steps), "utf8"));
  } catch (error) {
    return {
      steps: [],
      problems: [`${label}: 読めません（${reasonOf(error)}）`],
    };
  }
  const result = validateSteps(raw, label);
  if (result.problems.length > 0) {
    return result;
  }
  for (const [index, step] of result.steps.entries()) {
    if (step.op !== "call") {
      continue;
    }
    const script = resolve(dir, step.script);
    const path = relative(dir, script);
    if (path.startsWith("..") || isAbsolute(path)) {
      result.problems.push(
        `${label}: steps[${index}].script: 版のフォルダの外を指しています。`,
      );
    } else if (!(await isFile(script))) {
      result.problems.push(
        `${label}: steps[${index}].script: ${step.script} が見つかりません。`,
      );
    }
  }
  return result;
}

/** パッケージの `migrations/` から手元の版より新しく目標の版以下の `v{版}` を版の昇順に読み、形を検めて返す */
export async function loadMigrationVersions(options: {
  packageDir: string;
  from: string;
  to: string;
}): Promise<MigrationVersion[]> {
  const root = join(options.packageDir, MIGRATIONS_DIR.root);
  let names: string[];
  try {
    names = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
  const versions = names
    .filter(
      (name) =>
        VERSION_PATTERN.test(name) &&
        compareVersions(name, options.from) > 0 &&
        compareVersions(name, options.to) <= 0,
    )
    .sort(compareVersions);
  const loaded: MigrationVersion[] = [];
  const problems: string[] = [];
  for (const version of versions) {
    const dir = join(root, version);
    const result = await readStepsFile(
      dir,
      `${MIGRATIONS_DIR.root}/${version}/${MIGRATIONS_DIR.steps}`,
    );
    problems.push(...result.problems);
    loaded.push({ version, dir, steps: result.steps });
  }
  if (problems.length > 0) {
    throw new CliError(
      `移行の手順に誤りがあります（${problems.join("、")}）。mdmark を入れ直してください。`,
    );
  }
  return loaded;
}

/** 元のキーがあり新しいキーが無いときだけ、値とコメントを保って新しいキーへ移す */
export function renameKey(doc: Document, from: string, to: string): boolean {
  const fromPath = from.split(".");
  const toPath = to.split(".");
  if (!doc.hasIn(fromPath) || doc.hasIn(toPath)) {
    return false;
  }
  const fromParent = fromPath.slice(0, -1);
  const toParent = toPath.slice(0, -1);
  const oldName = fromPath[fromPath.length - 1];
  const newName = toPath[toPath.length - 1] ?? "";
  if (fromParent.join(".") === toParent.join(".")) {
    // 同じ親の下なら、元のキーの位置で名前だけを替える
    const parent =
      fromParent.length === 0 ? doc.contents : doc.getIn(fromParent, true);
    if (isMap(parent)) {
      const pair = parent.items.find(
        (item) => isScalar(item.key) && item.key.value === oldName,
      );
      if (pair && isScalar(pair.key)) {
        pair.key.value = newName;
        return true;
      }
    }
  }
  // 親が違えば、新しい親の末尾に移す
  const node = doc.getIn(fromPath, true);
  doc.deleteIn(fromPath);
  doc.setIn(toPath, node);
  return true;
}

/** キーが無いときだけ値を足す */
export function setDefault(
  doc: Document,
  key: string,
  value: unknown,
): boolean {
  const path = key.split(".");
  if (doc.hasIn(path)) {
    return false;
  }
  doc.setIn(path, value);
  return true;
}

/** スカラーが読み替えの表の元の値なら新しい値に替える */
function mapScalar(node: unknown, mapping: Record<string, unknown>): boolean {
  if (!isScalar(node)) {
    return false;
  }
  const value = node.value;
  const key =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : undefined;
  if (key === undefined || !Object.hasOwn(mapping, key)) {
    return false;
  }
  node.value = mapping[key];
  return true;
}

/** キーの値が読み替えの表の元の値のときだけ新しい値に替える。値が配列のときは要素ごとに替える */
export function mapValues(
  doc: Document,
  key: string,
  mapping: Record<string, unknown>,
): boolean {
  const node = doc.getIn(key.split("."), true);
  if (isSeq(node)) {
    let changed = false;
    for (const item of node.items) {
      changed = mapScalar(item, mapping) || changed;
    }
    return changed;
  }
  return mapScalar(node, mapping);
}

/** 文書の本文の `from` を全て `to` にする（文字列として一致した箇所を替える） */
export function replaceMark(text: string, from: string, to: string): string {
  return text.split(from).join(to);
}

/** 当てる全ての手順が書き換えうるファイルを、設定ファイルを先頭に重なりなく返す */
export function stepFiles(
  versions: MigrationVersion[],
  target: MigrationTarget,
): string[] {
  // 設定ファイルは版を書き換えるため、手順に関わらず含める
  const files = new Set<string>([target.configPath]);
  const addIndex = () => {
    if (target.indexPath !== undefined) {
      files.add(target.indexPath);
    }
  };
  const addDocuments = () => {
    for (const document of target.documents) {
      files.add(document);
    }
  };
  for (const { steps } of versions) {
    for (const step of steps) {
      switch (step.op) {
        case "replace_mark":
          addDocuments();
          break;
        case "call":
          if (step.files.includes("index")) {
            addIndex();
          }
          if (step.files.includes("documents")) {
            addDocuments();
          }
          break;
        default:
          if (step.file === "index") {
            addIndex();
          }
      }
    }
  }
  return [...files];
}

/** YAML のファイルを Document で読み、`edit` が書き換えたときだけ書き戻す */
async function editYaml(
  path: string,
  edit: (doc: Document) => boolean,
): Promise<void> {
  const doc = parseDocument(await readFile(path, "utf8"));
  const [first] = doc.errors;
  if (first) {
    throw new Error(`${path} を YAML として読めません（${reasonOf(first)}）`);
  }
  if (edit(doc)) {
    await writeFile(path, doc.toString({ flowCollectionPadding: false }));
  }
}

/** 手順 1 つを当て先へ当てる */
export async function applyStep(options: {
  step: MigrationStep;
  version: MigrationVersion;
  target: MigrationTarget;
}): Promise<void> {
  const { step, version, target } = options;
  try {
    switch (step.op) {
      case "replace_mark":
        for (const path of target.documents) {
          const text = await readFile(path, "utf8");
          const replaced = replaceMark(text, step.from, step.to);
          if (replaced !== text) {
            await writeFile(path, replaced);
          }
        }
        return;
      case "call": {
        const script = resolve(version.dir, step.script);
        try {
          await execFileAsync(
            process.execPath,
            [script, "--config", target.configPath],
            { cwd: dirname(target.configPath) },
          );
        } catch (error) {
          const code =
            isRecord(error) && typeof error.code === "number"
              ? `終了コード ${error.code} で終わりました`
              : reasonOf(error);
          throw new Error(`スクリプト ${step.script} が${code}`);
        }
        return;
      }
      default: {
        const path =
          step.file === "config" ? target.configPath : target.indexPath;
        // 設定に `index` が無ければ、索引の手順は何もしない
        if (path === undefined) {
          return;
        }
        await editYaml(path, (doc) => {
          switch (step.op) {
            case "rename_key":
              return renameKey(doc, step.from, step.to);
            case "map_values":
              return mapValues(doc, step.key, step.mapping);
            case "set_default": {
              if (step.ask === undefined) {
                return setDefault(doc, step.key, step.value);
              }
              const answer = target.answers.get(step);
              // 値を聞かなかった（キーが既にあった）ときは足さない
              return answer === undefined
                ? false
                : setDefault(doc, step.key, parse(answer));
            }
          }
        });
      }
    }
  } catch (error) {
    throw new CliError(
      `${version.version} の手順「${step.description}」に失敗しました（${reasonOf(error)}）。`,
    );
  }
}
