import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Parts/CodeBlock" } satisfies Meta<
  Record<string, unknown>
>;
export default meta;

/** ストーリー: 描画のインターフェース（`parameters.server.id`）の部品を `args` で描く */
type Story = StoryObj<Record<string, unknown>>;

export const TitleAndLineNumbers: Story = {
  name: "TitleAndLineNumbers",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "ts",
    title: "app.ts",
    lineNumbers: "true",
    lines:
      '[{"text":"import { mount } from \\"mdmark\\";"},{"text":"const doc = await fetch(\\"/README.md\\");","kind":"highlight"},{"text":"mount(document.querySelector(\\"#doc\\"), await doc.text());"}]',
  },
};

export const LineMarks: Story = {
  name: "LineMarks",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "ts",
    lines:
      '[{"text":"let count = 0;","kind":"del"},{"text":"let count = 1;","kind":"add"},{"text":"count += 1; // 数える","kind":"highlight"},{"text":"console.log(count);"}]',
  },
};

export const TitleOnly: Story = {
  name: "TitleOnly",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "yaml",
    title: "mdmark.config.yaml",
    lines:
      '[{"text":"features:"},{"text":"  code: true"},{"text":"  print: true"}]',
  },
};

export const TwoDigits: Story = {
  name: "TwoDigits",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "ts",
    lineNumbers: "true",
    lines:
      '[{"text":"import { mount } from \\"mdmark\\";"},{"text":""},{"text":"const element = document.querySelector(\\"#doc\\");"},{"text":"const response = await fetch(\\"/README.md\\");"},{"text":"const markdown = await response.text();"},{"text":""},{"text":"const config = {"},{"text":"  features: {"},{"text":"    code: true,","kind":"highlight"},{"text":"    print: true,","kind":"highlight"},{"text":"  },"},{"text":"};"},{"text":"mount(element, markdown, config);"}]',
  },
};

export const LongLineAndTitle: Story = {
  name: "LongLineAndTitle",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "ts",
    title:
      "src/render/syntax/a-file-name-that-is-much-longer-than-the-box-width-on-phones.ts",
    lineNumbers: "true",
    lines:
      '[{"text":"const url = \\"https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@v0.6.0/dist/index.js\\";"},{"text":"export const decorate = (tokens: Token[], options: { title?: string; lines: boolean; highlight: number[] }) => tokens;","kind":"del"},{"text":"export const decorate = (tokens: Token[], options: CodeBlockOptions, warnings: SyntaxWarning[]): Token[] => applyCodeBlockOptions(tokens, options, warnings);","kind":"add"}]',
  },
};

export const SyntaxPlain: Story = {
  name: "SyntaxPlain",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "ts",
    highlight: "true",
    lines:
      // biome-ignore lint/suspicious/noTemplateCurlyInString: 部品が描くコードの見本の文字列で、`${…}` は見本の中の文字
      '[{"text":"import { mount } from \\"mdmark\\";"},{"text":""},{"text":"// 文書を描く"},{"text":"const element: HTMLElement | null = document.querySelector(\\"#doc\\");"},{"text":"mount(element, `# 見出し ${300}`, { features: { syntax: true } });"}]',
  },
};

export const SyntaxWithLineMarks: Story = {
  name: "SyntaxWithLineMarks",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "ts",
    title: "app.ts",
    lineNumbers: "true",
    highlight: "true",
    lines:
      '[{"text":"const limit = 100;","kind":"del"},{"text":"const limit = 300;","kind":"add"},{"text":"const doc = await fetch(\\"/README.md\\");","kind":"highlight"},{"text":"mount(element, await doc.text());"}]',
  },
};

export const SyntaxMultilineToken: Story = {
  name: "SyntaxMultilineToken",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "ts",
    lineNumbers: "true",
    highlight: "true",
    lines:
      // biome-ignore lint/suspicious/noTemplateCurlyInString: 部品が描くコードの見本の文字列で、`${…}` は見本の中の文字
      '[{"text":"/*"},{"text":" * 文書を描く"},{"text":" */"},{"text":"const markdown = `# 見出し"},{"text":"本文 ${count}"},{"text":"`;","kind":"highlight"}]',
  },
};

export const SyntaxPython: Story = {
  name: "SyntaxPython",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "python",
    lineNumbers: "true",
    highlight: "true",
    lines:
      '[{"text":"@dataclass"},{"text":"class Doc:"},{"text":"    # 文書のタイトル"},{"text":"    title: str = \\"README\\""},{"text":"    lines: int = 300"},{"text":""},{"text":"print(len(Doc().title))"}]',
  },
};

export const LanguageLabel: Story = {
  name: "LanguageLabel",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "ts",
    copyState: "idle",
    lines:
      '[{"text":"import { mount } from \\"mdmark\\";"},{"text":"mount(document.querySelector(\\"#doc\\"), \\"# 見出し\\");"}]',
  },
};

export const FileName: Story = {
  name: "FileName",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "python",
    fileName: "hoge.py",
    copyState: "idle",
    lines: '[{"text":"def hello():"},{"text":"    print(\\"hello\\")"}]',
  },
};

export const LongFileName: Story = {
  name: "LongFileName",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "ts",
    fileName:
      "src/render/syntax/a-file-name-that-is-much-longer-than-the-box-width-on-phones.ts",
    title: "色分けの対象を探す",
    copyState: "idle",
    lines:
      '[{"text":"export const findTargets = (root: Element) => root.querySelectorAll(\\"code[data-mdmark-syntax]\\");"}]',
  },
};

export const NoLanguage: Story = {
  name: "NoLanguage",
  parameters: { server: { id: "code-block" } },
  args: { copyState: "idle", lines: '[{"text":"npm install mdmark"}]' },
};

export const Copied: Story = {
  name: "Copied",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "ts",
    copyState: "copied",
    lines: '[{"text":"import { mount } from \\"mdmark\\";"}]',
  },
};

export const CopyFailed: Story = {
  name: "CopyFailed",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "ts",
    copyState: "failed",
    lines: '[{"text":"import { mount } from \\"mdmark\\";"}]',
  },
};

export const Focus: Story = {
  name: "Focus",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "ts",
    lineNumbers: true,
    lines:
      '[{"text":"export function mount(element, markdown, options = {}) {","foldLines":10},{"text":"  const config = withDefaults(options);","indent":1},{"text":"  for (const block of parse(markdown)) {","kind":"focus","indent":1,"foldLines":4},{"text":"    if (block.kind === \\"table\\") {","kind":"focus","indent":2,"foldLines":1},{"text":"      attachTable(block, config.features);","indent":3},{"text":"    }","indent":2},{"text":"    element.append(render(block));","indent":2},{"text":"  }","indent":1},{"text":"  return () => {","indent":1,"foldLines":1},{"text":"    element.replaceChildren();","indent":2},{"text":"  };","indent":1},{"text":"}"}]',
  },
};

export const ErrorWarning: Story = {
  name: "ErrorWarning",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "ts",
    lineNumbers: true,
    lines:
      '[{"text":"export function mount(element, markdown, options = {}) {","foldLines":10},{"text":"  const config = withDefaults(options);","kind":"warning","indent":1},{"text":"  for (const block of parse(markdown)) {","indent":1,"foldLines":4},{"text":"    if (block.kind === \\"table\\") {","indent":2,"foldLines":1},{"text":"      attachTable(block, config.features);","kind":"error","indent":3},{"text":"    }","indent":2},{"text":"    element.append(render(block));","indent":2},{"text":"  }","indent":1},{"text":"  return () => {","indent":1,"foldLines":1},{"text":"    element.replaceChildren();","indent":2},{"text":"  };","indent":1},{"text":"}"}]',
  },
};

export const Foldable: Story = {
  name: "Foldable",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "ts",
    lineNumbers: true,
    lines:
      '[{"text":"export function mount(element, markdown, options = {}) {","foldLines":10},{"text":"  const config = withDefaults(options);","indent":1},{"text":"  for (const block of parse(markdown)) {","indent":1,"foldLines":4},{"text":"    if (block.kind === \\"table\\") {","indent":2,"foldLines":1},{"text":"      attachTable(block, config.features);","indent":3},{"text":"    }","indent":2},{"text":"    element.append(render(block));","indent":2},{"text":"  }","indent":1},{"text":"  return () => {","indent":1,"foldLines":1},{"text":"    element.replaceChildren();","indent":2},{"text":"  };","indent":1},{"text":"}"}]',
  },
};

export const FoldColumnHovered: Story = {
  name: "FoldColumnHovered",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "ts",
    lineNumbers: true,
    lines:
      '[{"text":"export function mount(element, markdown, options = {}) {","foldLines":10},{"text":"  const config = withDefaults(options);","indent":1},{"text":"  for (const block of parse(markdown)) {","indent":1,"foldLines":4},{"text":"    if (block.kind === \\"table\\") {","indent":2,"foldLines":1},{"text":"      attachTable(block, config.features);","indent":3},{"text":"    }","indent":2},{"text":"    element.append(render(block));","indent":2},{"text":"  }","indent":1},{"text":"  return () => {","indent":1,"foldLines":1},{"text":"    element.replaceChildren();","indent":2},{"text":"  };","indent":1},{"text":"}"}]',
    foldColumnHovered: true,
  },
};

export const Folded: Story = {
  name: "Folded",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "ts",
    lineNumbers: true,
    lines:
      '[{"text":"export function mount(element, markdown, options = {}) {","foldLines":10},{"text":"  const config = withDefaults(options);","indent":1},{"text":"  for (const block of parse(markdown)) {","indent":1,"foldLines":4,"folded":true},{"text":"    if (block.kind === \\"table\\") {","indent":2,"foldLines":1},{"text":"      attachTable(block, config.features);","indent":3},{"text":"    }","indent":2},{"text":"    element.append(render(block));","indent":2},{"text":"  }","indent":1},{"text":"  return () => {","indent":1,"foldLines":1},{"text":"    element.replaceChildren();","indent":2},{"text":"  };","indent":1},{"text":"}"}]',
  },
};

export const FoldNested: Story = {
  name: "FoldNested",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "ts",
    lineNumbers: true,
    lines:
      '[{"text":"export function mount(element, markdown, options = {}) {","foldLines":10},{"text":"  const config = withDefaults(options);","indent":1},{"text":"  for (const block of parse(markdown)) {","indent":1,"foldLines":4,"folded":true},{"text":"    if (block.kind === \\"table\\") {","indent":2,"foldLines":1,"folded":true},{"text":"      attachTable(block, config.features);","indent":3},{"text":"    }","indent":2},{"text":"    element.append(render(block));","indent":2},{"text":"  }","indent":1},{"text":"  return () => {","indent":1,"foldLines":1,"folded":true},{"text":"    element.replaceChildren();","indent":2},{"text":"  };","indent":1},{"text":"}"}]',
  },
};

export const FoldNoLineNumbers: Story = {
  name: "FoldNoLineNumbers",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "yaml",
    lines:
      '[{"text":"version: \\"0.9\\""},{"text":"features:","foldLines":2},{"text":"  table: true","indent":1},{"text":"  diagram: true","indent":1},{"text":"libraries:","foldLines":3},{"text":"  highlight:","indent":1,"foldLines":2,"folded":true},{"text":"    url: https://cdn.jsdelivr.net/npm/highlight.js","indent":2},{"text":"    version: 11.11.1","indent":2},{"text":"build:","foldLines":1},{"text":"  - docs/使用方法/導入/README.md","indent":1}]',
  },
};

export const Wrap: Story = {
  name: "Wrap",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "ts",
    title: "app.ts",
    lineNumbers: true,
    wrap: true,
    lines:
      '[{"text":"import { mount } from \\"mdmark\\";"},{"text":"const url = \\"https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@v0.10.0/dist/index.js\\"; // バージョンを固定した URL から配布物を読み込み、描く先の要素に文書を描く"},{"text":"mount(document.querySelector(\\"#doc\\"), markdown);"}]',
  },
};

export const LineStart: Story = {
  name: "LineStart",
  parameters: { server: { id: "code-block" } },
  args: {
    language: "ts",
    title: "src/app.ts の抜粋",
    lineNumbers: true,
    lineStart: 10,
    lines:
      '[{"text":"import { mount } from \\"mdmark\\";"},{"text":"const doc = await fetch(\\"/README.md\\");","kind":"highlight"},{"text":"mount(document.querySelector(\\"#doc\\"), await doc.text());","kind":"highlight"}]',
  },
};
