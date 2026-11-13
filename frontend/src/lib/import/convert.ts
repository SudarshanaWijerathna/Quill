/**
 * Plain-text and Markdown → Tiptap JSON conversion.
 *
 * Output uses only node/mark types registered by the editor (components/editor/extensions.ts),
 * so imported documents open and save like any other. Nothing is ever interpreted as HTML: raw
 * HTML in a file stays literal text (Tiptap renders text nodes as text, never as markup).
 *
 * Markdown support (CommonMark + GitHub-flavored subset):
 *   Blocks:  headings (#–######, setext ===/---; levels 4–6 become H3), paragraphs, bullet lists
 *            (- * +), numbered lists (1. 1)) with nesting and start numbers, task lists
 *            (- [ ] / - [x]), blockquotes (nested, lazy continuation), fenced code blocks with a
 *            language (``` or ~~~), horizontal rules, GFM pipe tables (header row + body rows).
 *   Inline:  **bold**, __bold__, *italic*, _italic_, ***bold italic***, ~~strikethrough~~,
 *            `code`, [links](https://…), <https://autolinks>, bare https:// URLs, hard line
 *            breaks, backslash escapes.
 *   Links are only created for http(s) and mailto URLs; anything else (javascript:, data:, …)
 *   becomes plain text. Images become their alt text.
 * Anything else is kept as plain text.
 */
import { isSafeUrl } from '@/lib/links'

// Type aliases (not interfaces) so they stay assignable to the generic DocumentContent record.
export type TiptapMark = { type: string; attrs?: Record<string, unknown> }
export type TiptapNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  text?: string
  marks?: TiptapMark[]
}
export type TiptapDoc = TiptapNode & { type: 'doc'; content: TiptapNode[] }

// ---- Shared helpers ------------------------------------------------------------------------------

function normalize(text: string): string {
  return text
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
}

const isBlank = (line: string) => line.trim() === ''

function paragraph(content: TiptapNode[]): TiptapNode {
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}

function doc(blocks: TiptapNode[]): TiptapDoc {
  return { type: 'doc', content: blocks.length ? blocks : [{ type: 'paragraph' }] }
}

// ---- Plain text --------------------------------------------------------------------------------

/** Blank lines separate paragraphs; single line breaks inside a paragraph are kept as hard breaks. */
export function textToDoc(input: string): TiptapDoc {
  const blocks = normalize(input)
    .split(/\n[ \t]*\n/)
    .map((chunk) => chunk.replace(/^\n+|\n+$/g, ''))
    .filter((chunk) => chunk.trim() !== '')
    .map((chunk) => {
      const content: TiptapNode[] = []
      chunk.split('\n').forEach((line, i) => {
        if (i > 0) content.push({ type: 'hardBreak' })
        const text = line.trimEnd()
        if (text) content.push({ type: 'text', text })
      })
      return paragraph(content)
    })
  return doc(blocks)
}

// ---- Markdown: inline ----------------------------------------------------------------------------

// Backslash-escaped punctuation is swapped for private-use code points during parsing so it can
// never be mistaken for syntax, then restored.
const ESCAPABLE = /\\([\\`*_{}[\]()#+\-.!>~|<])/g
const PUA_BASE = 0xe000
const escapeMarkdown = (s: string) =>
  s.replace(ESCAPABLE, (_, ch: string) => String.fromCharCode(PUA_BASE + ch.charCodeAt(0)))
const restoreEscapes = (s: string) =>
  s.replace(/[-]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - PUA_BASE))

type InlineRule =
  | { kind: 'code'; re: RegExp }
  | { kind: 'marks'; re: RegExp; marks: string[] }
  | { kind: 'link'; re: RegExp }
  | { kind: 'autolink'; re: RegExp }
  | { kind: 'url'; re: RegExp }

const INLINE_RULES: InlineRule[] = [
  { kind: 'code', re: /`([^`\n]+)`/ },
  { kind: 'link', re: /(!?)\[([^\]\n]*)\]\(<?([^)\s>]*)>?(?:\s+"[^"\n]*")?\)/ },
  { kind: 'autolink', re: /<((?:https?:\/\/|mailto:)[^\s<>]+)>/i },
  // Bare URL (GFM autolink literal); trailing punctuation is not part of the link.
  { kind: 'url', re: /(?<![\w/])https?:\/\/[^\s<>]*[^\s<>.,;:!?"')\]]/i },
  { kind: 'marks', re: /\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/, marks: ['bold', 'italic'] },
  // (?!\*): in "**bold *italic***" the bold closes at the final "**", not inside "***".
  { kind: 'marks', re: /\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/, marks: ['bold'] },
  { kind: 'marks', re: /(?<![\p{L}\p{N}])__(?=\S)([\s\S]*?\S)__(?![\p{L}\p{N}])/u, marks: ['bold'] },
  { kind: 'marks', re: /~~(?=\S)([\s\S]*?\S)~~/, marks: ['strike'] },
  { kind: 'marks', re: /\*(?=\S)([\s\S]*?\S)\*/, marks: ['italic'] },
  { kind: 'marks', re: /(?<![\p{L}\p{N}])_(?=\S)([\s\S]*?\S)_(?![\p{L}\p{N}])/u, marks: ['italic'] },
]

function withMark(marks: TiptapMark[], mark: TiptapMark): TiptapMark[] {
  return [...marks.filter((m) => m.type !== mark.type), mark]
}

function textNode(text: string, marks: TiptapMark[]): TiptapNode | null {
  const value = restoreEscapes(text)
  if (!value) return null // ProseMirror forbids empty text nodes
  return marks.length ? { type: 'text', text: value, marks } : { type: 'text', text: value }
}

const linkMark = (href: string): TiptapMark => ({ type: 'link', attrs: { href } })

function parseInlineSegment(text: string, marks: TiptapMark[]): TiptapNode[] {
  const out: TiptapNode[] = []
  const push = (node: TiptapNode | null) => node && out.push(node)
  let rest = text
  while (rest) {
    let best: { rule: InlineRule; match: RegExpExecArray } | null = null
    for (const rule of INLINE_RULES) {
      const match = rule.re.exec(rest)
      if (match && (!best || match.index < best.match.index)) best = { rule, match }
    }
    if (!best) {
      push(textNode(rest, marks))
      break
    }
    const { rule, match } = best
    push(textNode(rest.slice(0, match.index), marks))

    if (rule.kind === 'code') {
      // Tiptap's code mark excludes all other marks.
      push(textNode(match[1]!, [{ type: 'code' }]))
    } else if (rule.kind === 'link') {
      const [, bang, label, rawUrl] = match
      const href = restoreEscapes(rawUrl ?? '')
      if (bang) {
        push(textNode(label!, marks)) // images → alt text only
      } else if (href && isSafeUrl(href)) {
        const content = parseInlineSegment(label || href, withMark(marks, linkMark(href)))
        out.push(...content)
      } else {
        // Unsafe or relative target (javascript:, data:, ./page.md, …): keep the label only.
        out.push(...parseInlineSegment(label!, marks))
      }
    } else if (rule.kind === 'autolink' || rule.kind === 'url') {
      const href = restoreEscapes(rule.kind === 'autolink' ? match[1]! : match[0])
      push(textNode(href, isSafeUrl(href) ? withMark(marks, linkMark(href)) : marks))
    } else {
      out.push(...parseInlineSegment(match[1]!, rule.marks.reduce((acc, type) => withMark(acc, { type }), marks)))
    }
    rest = rest.slice(match.index + match[0].length)
  }
  return out
}

/** Inline Markdown → text nodes. "\n" in the input marks a hard line break. */
function parseInline(text: string): TiptapNode[] {
  const out: TiptapNode[] = []
  escapeMarkdown(text)
    .split('\n')
    .forEach((segment, i) => {
      if (i > 0) out.push({ type: 'hardBreak' })
      out.push(...parseInlineSegment(segment, []))
    })
  // Merge adjacent text nodes with identical marks (keeps the JSON tidy).
  return out.reduce<TiptapNode[]>((acc, node) => {
    const prev = acc[acc.length - 1]
    if (prev?.type === 'text' && node.type === 'text' && JSON.stringify(prev.marks) === JSON.stringify(node.marks)) {
      prev.text += node.text!
    } else {
      acc.push(node)
    }
    return acc
  }, [])
}

/** Join paragraph source lines: soft breaks become spaces, "  " or "\" line endings hard breaks. */
function joinLines(lines: string[]): string {
  return lines
    .map((line, i) => {
      const last = i === lines.length - 1
      const hard = !last && (/ {2,}$/.test(line) || /\\$/.test(line))
      const text = line.trim().replace(/\\$/, hard ? '' : '\\')
      return last ? text : text + (hard ? '\n' : ' ')
    })
    .join('')
}

// ---- Markdown: blocks ----------------------------------------------------------------------------

const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/
const FENCE = /^( {0,3})(`{3,}|~{3,})[ \t]*([^\s`]*)/
const HR = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
const BLOCKQUOTE = /^ {0,3}>/
const LIST_ITEM = /^( *)([-*+]|\d{1,9}[.)])(?:[ \t]+(.*))?$/
const TASK_MARKER = /^\[([ xX])\](?:[ \t]+(.*))?$/
const SETEXT_H1 = /^ {0,3}=+[ \t]*$/
const SETEXT_H2 = /^ {0,3}-+[ \t]*$/
const TABLE_DELIMITER = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/

const isOrderedMarker = (marker: string) => /\d/.test(marker)

/** Split a pipe-table row into cell sources ("\|" is an escaped, literal pipe). */
function splitTableRow(line: string): string[] {
  let row = escapeMarkdown(line.trim())
  if (row.startsWith('|')) row = row.slice(1)
  if (row.endsWith('|')) row = row.slice(0, -1)
  return row.split('|').map((cell) => cell.trim())
}

function isTableStart(lines: string[], i: number): boolean {
  const header = lines[i]!
  const delimiter = lines[i + 1]
  if (!header.includes('|') || delimiter === undefined || !TABLE_DELIMITER.test(delimiter)) return false
  return splitTableRow(header).length === splitTableRow(delimiter).length
}

function startsBlock(lines: string[], i: number): boolean {
  const line = lines[i]!
  return (
    ATX_HEADING.test(line) ||
    FENCE.test(line) ||
    HR.test(line) ||
    BLOCKQUOTE.test(line) ||
    LIST_ITEM.test(line) ||
    isTableStart(lines, i)
  )
}

function heading(level: number, text: string): TiptapNode {
  const content = parseInline(text.trim())
  return { type: 'heading', attrs: { level: Math.min(level, 3) }, ...(content.length ? { content } : {}) }
}

function parseTable(lines: string[], start: number): [TiptapNode, number] {
  const header = splitTableRow(lines[start]!)
  const columns = header.length
  const rows: string[][] = []
  let i = start + 2 // skip header + delimiter
  while (i < lines.length && !isBlank(lines[i]!) && lines[i]!.includes('|') && !startsBlock(lines, i)) {
    const cells = splitTableRow(lines[i]!)
    // GFM: extra cells are dropped, missing cells are empty.
    rows.push(Array.from({ length: columns }, (_, c) => cells[c] ?? ''))
    i++
  }
  // Cells were escaped by splitTableRow; parseInline would escape again, so restore first.
  const cell = (type: 'tableHeader' | 'tableCell', source: string): TiptapNode => ({
    type,
    content: [paragraph(parseInline(restoreEscapes(source)))],
  })
  const table: TiptapNode = {
    type: 'table',
    content: [
      { type: 'tableRow', content: header.map((h) => cell('tableHeader', h)) },
      ...rows.map((r) => ({ type: 'tableRow', content: r.map((c) => cell('tableCell', c)) })),
    ],
  }
  return [table, i]
}

interface ListItemDraft {
  lines: string[]
  children: TiptapNode[]
  checked: boolean | null // null = not a task item
}

function parseList(lines: string[], start: number): [TiptapNode, number] {
  const first = lines[start]!.match(LIST_ITEM)!
  const indent = first[1]!.length
  const ordered = isOrderedMarker(first[2]!)
  const startNumber = ordered ? parseInt(first[2]!, 10) : 1
  const items: ListItemDraft[] = []
  let i = start

  while (i < lines.length) {
    const line = lines[i]!
    if (isBlank(line)) {
      // A blank line ends the list unless the next content line continues it.
      let j = i + 1
      while (j < lines.length && isBlank(lines[j]!)) j++
      const next = j < lines.length ? lines[j]!.match(LIST_ITEM) : null
      if (next && next[1]!.length >= indent && (next[1]!.length > indent || isOrderedMarker(next[2]!) === ordered)) {
        i = j
        continue
      }
      break
    }

    const m = line.match(LIST_ITEM)
    if (!m || HR.test(line)) {
      // Indented continuation of the current item's text.
      const current = items[items.length - 1]
      const lineIndent = line.match(/^ */)![0].length
      if (current && lineIndent > indent && !startsBlock([line.trimStart()], 0)) {
        current.lines.push(line)
        i++
        continue
      }
      break
    }

    const itemIndent = m[1]!.length
    if (itemIndent < indent) break
    if (itemIndent > indent && items.length) {
      const [nested, next] = parseList(lines, i)
      items[items.length - 1]!.children.push(nested)
      i = next
      continue
    }
    if (isOrderedMarker(m[2]!) !== ordered) break // a different list type starts a new list
    const text = m[3] ?? ''
    const task = ordered ? null : text.match(TASK_MARKER)
    items.push({ lines: [task ? (task[2] ?? '') : text], children: [], checked: task ? task[1] !== ' ' : null })
    i++
  }

  // A bullet list becomes a task list only if every item has a checkbox (Tiptap can't mix them).
  const isTaskList = !ordered && items.every((item) => item.checked !== null)
  const itemNode = (item: ListItemDraft): TiptapNode => {
    const text = isTaskList ? joinLines(item.lines) : joinLines(item.lines.map((l, idx) =>
      idx === 0 && item.checked !== null ? `[${item.checked ? 'x' : ' '}] ${l}` : l,
    ))
    const content = [paragraph(parseInline(text)), ...item.children]
    return isTaskList
      ? { type: 'taskItem', attrs: { checked: item.checked }, content }
      : { type: 'listItem', content }
  }

  const listNode: TiptapNode = {
    type: isTaskList ? 'taskList' : ordered ? 'orderedList' : 'bulletList',
    ...(ordered && startNumber !== 1 ? { attrs: { start: startNumber } } : {}),
    content: items.map(itemNode),
  }
  return [listNode, i]
}

function parseBlocks(lines: string[]): TiptapNode[] {
  const blocks: TiptapNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!
    if (isBlank(line)) {
      i++
      continue
    }

    const fence = line.match(FENCE)
    if (fence) {
      const [, fenceIndent, marker, info] = fence
      const closing = new RegExp(`^ {0,3}${marker![0] === '`' ? '`' : '~'}{${marker!.length},}[ \\t]*$`)
      const body: string[] = []
      i++
      while (i < lines.length && !closing.test(lines[i]!)) {
        // Remove up to the fence's own indentation from content lines (CommonMark).
        body.push(lines[i]!.replace(new RegExp(`^ {0,${fenceIndent!.length}}`), ''))
        i++
      }
      i++ // closing fence (or end of file)
      const text = body.join('\n')
      const language = info ? restoreEscapes(info).toLowerCase().slice(0, 32) : null
      blocks.push({
        type: 'codeBlock',
        attrs: { language },
        ...(text ? { content: [{ type: 'text', text }] } : {}),
      })
      continue
    }

    const atx = line.match(ATX_HEADING)
    if (atx) {
      blocks.push(heading(atx[1]!.length, atx[2] ?? ''))
      i++
      continue
    }

    if (HR.test(line)) {
      blocks.push({ type: 'horizontalRule' })
      i++
      continue
    }

    if (BLOCKQUOTE.test(line)) {
      const body: string[] = []
      while (i < lines.length) {
        const current = lines[i]!
        if (BLOCKQUOTE.test(current)) {
          body.push(current.replace(/^ {0,3}> ?/, ''))
        } else if (!isBlank(current) && body.length && !isBlank(body[body.length - 1]!) && !startsBlock(lines, i)) {
          body.push(current) // lazy continuation of a quoted paragraph
        } else {
          break
        }
        i++
      }
      const inner = parseBlocks(body)
      blocks.push({ type: 'blockquote', content: inner.length ? inner : [{ type: 'paragraph' }] })
      continue
    }

    if (isTableStart(lines, i)) {
      const [table, next] = parseTable(lines, i)
      blocks.push(table)
      i = next
      continue
    }

    if (LIST_ITEM.test(line)) {
      const [list, next] = parseList(lines, i)
      blocks.push(list)
      i = next
      continue
    }

    // Paragraph (possibly a setext heading).
    const para = [line]
    i++
    let setextLevel = 0
    while (i < lines.length && !isBlank(lines[i]!)) {
      if (SETEXT_H1.test(lines[i]!)) setextLevel = 1
      else if (SETEXT_H2.test(lines[i]!)) setextLevel = 2
      if (setextLevel) {
        i++
        break
      }
      if (startsBlock(lines, i)) break
      para.push(lines[i++]!)
    }
    const text = joinLines(para)
    blocks.push(setextLevel ? heading(setextLevel, text) : paragraph(parseInline(text)))
  }
  return blocks
}

export function markdownToDoc(input: string): TiptapDoc {
  return doc(parseBlocks(normalize(input).split('\n')))
}
