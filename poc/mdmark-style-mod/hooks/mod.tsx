import type { Register } from 'claude-code'

// PoC: 返答・発言の描き換え、マーカーの受け取り、hover のカード、SessionStart の注入を確認する最小構成
const LOG_DIR = '/tmp/mdmark-style-poc'
const TERM = 'mdmark'
const TERM_MEANING = 'Markdown 文書の表示を各アプリで共通に使用するライブラリ'
const GUIDE_WORD = 'POC-KIWI-7341'
const GUIDE = [
  'mdmark-style の PoC: 表の直前に <!-- table: {"kind": "data"} --> を記載すると、表の先頭の行を太字で描く。',
  `確認用の合言葉は ${GUIDE_WORD}。`,
].join('\n')
const MARKER = /<!--[\s\S]*?-->/g
const MARKER_LINE = /^<!--[\s\S]*-->$/
const DATA_TABLE = /^<!--\s*table:\s*\{\s*"kind"\s*:\s*"data"\s*\}\s*-->$/
const THROW_WORD = 'POC-THROW'

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'table'; rows: string[][]; isData: boolean }
  | { kind: 'callout'; label: string; lines: string[] }
  | { kind: 'code'; language: string; source: string }
  | { kind: 'text'; text: string }

const splitCells = (line: string): string[] =>
  line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())

const isSeparator = (cells: string[]): boolean => cells.every(cell => /^:?-+:?$/.test(cell))

const parse = (text: string): Block[] => {
  const lines = text.split('\n')
  const blocks: Block[] = []
  let isNextData = false
  let i = 0
  while (i < lines.length) {
    const trimmed = lines[i].trim()
    if (DATA_TABLE.test(trimmed)) {
      isNextData = true
      i++
      continue
    }
    if (MARKER_LINE.test(trimmed)) {
      i++
      continue
    }
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim()
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) body.push(lines[i++])
      blocks.push({ kind: 'code', language, source: body.join('\n') })
      i++
      continue
    }
    if (trimmed.startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = splitCells(lines[i++])
        if (!isSeparator(cells)) rows.push(cells)
      }
      blocks.push({ kind: 'table', rows, isData: isNextData })
      isNextData = false
      continue
    }
    const callout = /^>\s*\[!(\w+)\]/.exec(trimmed)
    if (callout) {
      const body: string[] = []
      i++
      while (i < lines.length && lines[i].trim().startsWith('>')) body.push(lines[i++].trim().replace(/^>\s?/, ''))
      blocks.push({ kind: 'callout', label: callout[1], lines: body })
      continue
    }
    const heading = /^#{1,6}\s+(.*)$/.exec(trimmed)
    if (heading) blocks.push({ kind: 'heading', text: heading[1] })
    else if (trimmed !== '') blocks.push({ kind: 'text', text: lines[i].replace(MARKER, '').replace(/\s{2,}/g, ' ') })
    i++
  }
  return blocks
}

export const register: Register = on => {
  on('classic.SessionStart', async ($, e, next) => {
    const result = await next(e)
    await $.fs.write(`${LOG_DIR}/session-start-${await $.clock.now()}.json`, JSON.stringify(e))
    return { ...result, additionalContext: [...(result.additionalContext ?? []), GUIDE] }
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const text = e.props.text
    await $.fs.write(`${LOG_DIR}/assistant-${e.surface}-${e.requestId}.txt`, text)
    if (text.includes(THROW_WORD)) throw new Error('PoC: 元の描画への切り替えの確認')
    const { Box, Text, Code } = $.ui.resolve(e)
    const columns = e.viewport?.columns ?? 80
    const drawn = parse(text).map((block, index) => {
      switch (block.kind) {
        case 'heading':
          return <Text key={`h${index}`} bold color="cyan">{block.text}</Text>
        case 'code':
          return <Code key={`c${index}`} source={block.source} language={block.language || undefined} />
        case 'callout':
          return (
            <Box key={`n${index}`} flexDirection="row">
              <Text color="blue">┃ </Text>
              <Box flexDirection="column">
                <Text bold color="blue">{block.label}</Text>
                {block.lines.map((line, j) => <Text key={`n${index}-${j}`}>{line}</Text>)}
              </Box>
            </Box>
          )
        case 'table': {
          const widths = block.rows[0].map((_, c) => Math.max(...block.rows.map(row => (row[c] ?? '').length)) + 2)
          const width = Math.min(columns - 2, widths.reduce((sum, w) => sum + w, 0) + 2)
          return (
            <Box key={`t${index}`} flexDirection="column" borderStyle="single" width={width}>
              {block.rows.map((row, r) => (
                <Box key={`t${index}-${r}`} flexDirection="row">
                  {row.map((cell, c) => (
                    <Box key={`t${index}-${r}-${c}`} width={widths[c]}>
                      <Text bold={block.isData && r === 0}>{cell}</Text>
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          )
        }
        case 'text':
          return <Text key={`p${index}`}>{block.text}</Text>
        default: {
          const unreachable: never = block
          return unreachable
        }
      }
    })
    return <Box flexDirection="column">{drawn}</Box>
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const text = e.props.text
    await $.fs.write(`${LOG_DIR}/user-${e.surface}-${e.requestId}.txt`, text)
    const at = text.indexOf(TERM)
    if (at < 0) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Text>{text.slice(0, at)}</Text>
          <Box key="term">
            <Text underline>{TERM}</Text>
            <Box position="absolute" top={1} left={0} display="none" hover={{ display: 'flex' }} borderStyle="round">
              <Text>CARD: {TERM_MEANING}</Text>
            </Box>
          </Box>
          <Text>{text.slice(at + TERM.length)}</Text>
        </Box>
        <Text dimColor>[1] {TERM}: {TERM_MEANING}</Text>
      </Box>
    )
  })
}
