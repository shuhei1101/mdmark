import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { parse, stringify } from "yaml";

/** リポジトリの直下からのエージェントフローのフォルダ */
export const AGENT_FLOW_DIR = "docs/agent-flow";

/** 番号付きの箇条書きの 2 行目以降の字下げ */
const ITEM_INDENT = "   ";

/** エージェントフローの工程で呼ぶもの（SKILL.md に出すのはコマンドだけ） */
type FlowCall = { type: string; command?: string };

/** エージェントフローの工程 */
type FlowStep = {
  name: string;
  body?: string;
  when?: string;
  calls?: FlowCall[];
};

/** スキルの引数 */
type SkillArgument = { name: string; hint: string; description: string };

/** `type: skill` のエージェントフローのスキルに固有の項目 */
type SkillSpec = {
  path: string;
  name?: string;
  arguments?: SkillArgument[];
  allowed_tools?: string[];
  frontmatter?: Record<string, unknown>;
};

/** 値がオブジェクトか */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** 工程で使用するコマンドを示す行にする。コマンドが無ければ undefined */
const commandLine = (calls: FlowCall[]): string | undefined => {
  const commands = calls
    .map((call) => call.command)
    .filter((command): command is string => command !== undefined);
  return commands.length > 0
    ? `コマンド: ${commands.map((command) => `\`${command}\``).join("・")}`
    : undefined;
};

/** 工程の本文の行に、コマンドを示す行を加える */
const withCommand = (step: FlowStep, command: string | undefined): string[] => {
  const lines = (step.body ?? step.name).split("\n");
  const commands = command === undefined ? [] : [command];
  // 本文が箇条書きで始まるときは、工程の名前とコマンドを箇条書きの前に置く
  if (lines[0]?.startsWith("- ") === true) {
    return [`${step.name}。`, ...commands, ...lines];
  }
  return [...lines, ...commands];
};

/** 工程 1 つを番号付きの箇条書きの 1 項目にする */
const renderStep = (step: FlowStep, index: number): string => {
  const [first = "", ...rest] = withCommand(
    step,
    commandLine(step.calls ?? []),
  );
  const when = step.when === undefined ? "" : `${step.when}: `;
  return [
    `${index + 1}. ${when}${first}`,
    ...rest.map((line) => (line === "" ? "" : `${ITEM_INDENT}${line}`)),
  ].join("\n");
};

/** `type: skill` のエージェントフロー 1 枚から SKILL.md の文字列を作る */
export const renderSkillMd = (flow: Record<string, unknown>): string => {
  const skill = flow.skill;
  if (
    flow.type !== "skill" ||
    !isRecord(skill) ||
    typeof skill.path !== "string"
  ) {
    throw new Error(
      `エージェントフロー ${String(flow.id)} は type: skill と skill.path を持つ必要があります`,
    );
  }
  const spec = skill as SkillSpec;
  const args = spec.arguments ?? [];
  const frontmatter: Record<string, unknown> = {
    name: spec.name ?? basename(dirname(spec.path)),
    description: flow.summary,
    ...(args.length > 0 && {
      arguments: args.map((arg) => arg.name),
      "argument-hint": args.map((arg) => `[${arg.hint}]`).join(" "),
    }),
    ...(spec.allowed_tools !== undefined && {
      "allowed-tools": spec.allowed_tools.join(", "),
    }),
    ...spec.frontmatter,
  };
  const steps = (flow.steps as FlowStep[]).map(renderStep);
  const sections = [
    `# ${String(flow.title)}`,
    ...(args.length > 0
      ? [
          [
            "## 引数",
            "",
            ...args.map((arg) => `- \`$${arg.name}\`: ${arg.description}`),
          ].join("\n"),
        ]
      : []),
    ["## 手順", "", ...steps].join("\n"),
  ];
  return `---\n${stringify(frontmatter, { lineWidth: 0 })}---\n\n${sections.join("\n\n")}\n`;
};

/** `docs/agent-flow/` の `type: skill` のエージェントフローごとに、`skill.path` へ SKILL.md を書き出す */
export const writeSkills = async (options: {
  /** 作業ツリーの場所 */
  root: string;
}): Promise<string[]> => {
  const { root } = options;
  const dir = join(root, AGENT_FLOW_DIR);
  if (!existsSync(dir)) {
    return [];
  }
  const names = (await readdir(dir))
    .filter((name) => name.endsWith(".yaml") && name !== "index.yaml")
    .sort();
  const written: string[] = [];
  for (const name of names) {
    const flow: unknown = parse(await readFile(join(dir, name), "utf8"));
    if (!isRecord(flow) || flow.type !== "skill") {
      continue;
    }
    const markdown = renderSkillMd(flow);
    const path = (flow.skill as SkillSpec).path;
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), markdown);
    written.push(path);
  }
  return written;
};
