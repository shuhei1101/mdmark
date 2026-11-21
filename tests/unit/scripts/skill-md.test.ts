import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { parse, stringify } from "yaml";
import { useTempDirs, writeFiles } from "../helpers/cli.ts";

/** SKILL.md の生成を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSkillMd = () => import("../../../scripts/skill-md.ts");

const createTempDir = useTempDirs();

/** リポジトリの直下 */
const REPOSITORY_ROOT = join(import.meta.dirname, "..", "..", "..");

/** テストで使用する `type: skill` のエージェントフローを作る */
const createSkillFlow = (overrides: Record<string, unknown> = {}) => ({
  id: "sample",
  type: "skill",
  title: "見本のスキル",
  summary: "見本の手順を進める",
  skill: {
    path: "plugin/skills/sample/SKILL.md",
    name: "sample",
    allowed_tools: ["Bash(node a.js *)", "Bash(node b.js)"],
  },
  steps: [
    { name: "最初の工程", body: "状態を示す。" },
    {
      name: "次の工程",
      when: "設定があるとき",
      body: "書き込む。",
      calls: [{ type: "command", command: "node a.js write" }],
    },
  ],
  ...overrides,
});

/** SKILL.md の frontmatter を読み込む */
const readFrontmatter = (markdown: string): Record<string, unknown> => {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(markdown);
  if (match === null) {
    throw new Error("frontmatter がありません");
  }
  return parse(match[1] ?? "") as Record<string, unknown>;
};

// frontmatter と手順を作る（正常系）
test("test_render_skill_md", async () => {
  // 準備
  const { renderSkillMd } = await loadSkillMd();
  // 実行
  const markdown = renderSkillMd(createSkillFlow());
  // 検証
  const frontmatter = readFrontmatter(markdown);
  expect(frontmatter.name).toBe("sample");
  expect(frontmatter.description).toBe("見本の手順を進める");
  expect(frontmatter["allowed-tools"]).toBe(
    "Bash(node a.js *), Bash(node b.js)",
  );
  const steps = markdown.slice(markdown.indexOf("## 手順"));
  const items = steps.split("\n").filter((line) => /^\d+\. /.test(line));
  expect(items).toHaveLength(2);
  expect(items[1]).toMatch(/^2\. 設定があるとき:/);
  expect(items[1]).toContain("`node a.js write`");
  expect(markdown.endsWith("\n")).toBe(true);
  expect(markdown.endsWith("\n\n")).toBe(false);
});

// 引数を frontmatter と本文に出す（正常系）
test("test_render_skill_md_with_arguments", async () => {
  // 準備
  const { renderSkillMd } = await loadSkillMd();
  const flow = createSkillFlow({
    skill: {
      path: "plugin/skills/sample/SKILL.md",
      arguments: [
        {
          name: "dir",
          hint: "文書のフォルダ",
          description: "文書のフォルダ。省くと作業のフォルダ",
        },
      ],
    },
  });
  // 実行
  const markdown = renderSkillMd(flow);
  // 検証
  const frontmatter = readFrontmatter(markdown);
  expect(frontmatter.name).toBe("sample");
  expect(frontmatter.arguments).toBeDefined();
  expect(frontmatter["argument-hint"]).toBeDefined();
  const argumentsSection = markdown.slice(
    markdown.indexOf("## 引数"),
    markdown.indexOf("## 手順"),
  );
  expect(argumentsSection).toContain("$dir");
  expect(argumentsSection).toContain("文書のフォルダ。省くと作業のフォルダ");
});

// type が skill でなければ誤りにする（異常系）
test("test_render_skill_md_when_not_skill", async () => {
  // 準備
  const { renderSkillMd } = await loadSkillMd();
  // 実行・検証
  expect(() => renderSkillMd(createSkillFlow({ type: "flow" }))).toThrow(Error);
});

// skill のエージェントフローだけを書き出す（正常系）
test("test_write_skills", async () => {
  // 準備
  const { writeSkills } = await loadSkillMd();
  const root = await createTempDir();
  await writeFiles(root, {
    "docs/agent-flow/index.yaml": stringify({ summary: "目次", items: [] }),
    "docs/agent-flow/sample.yaml": stringify(createSkillFlow()),
    "docs/agent-flow/other.yaml": stringify({
      id: "other",
      type: "flow",
      summary: "別の手順",
      condition: "いつでも",
      steps: [{ name: "工程" }],
    }),
  });
  // 実行
  const written = await writeSkills({ root });
  // 検証
  expect(written).toEqual(["plugin/skills/sample/SKILL.md"]);
  expect(existsSync(join(root, "plugin/skills/sample/SKILL.md"))).toBe(true);
});

// リポジトリの SKILL.md がエージェントフローと一致する（正常系）
test("test_skill_md_matches_repository", async () => {
  // 準備
  const { renderSkillMd } = await loadSkillMd();
  const flowDir = join(REPOSITORY_ROOT, "docs", "agent-flow");
  const names = (await readdir(flowDir)).filter(
    (name) => name.endsWith(".yaml") && name !== "index.yaml",
  );
  const flows = await Promise.all(
    names.map(
      async (name) =>
        parse(await readFile(join(flowDir, name), "utf8")) as Record<
          string,
          unknown
        >,
    ),
  );
  const skills = flows.filter((flow) => flow.type === "skill");
  expect(skills.length).toBeGreaterThan(0);
  for (const flow of skills) {
    const path = (flow.skill as { path: string }).path;
    // 実行
    const markdown = renderSkillMd(flow);
    // 検証
    expect(markdown).toBe(await readFile(join(REPOSITORY_ROOT, path), "utf8"));
  }
});
