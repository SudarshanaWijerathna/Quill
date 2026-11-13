import { getSchema } from '@tiptap/core'
import { Node as PMNode } from '@tiptap/pm/model'
import { describe, expect, it } from 'vitest'
import { createExtensions } from '@/components/editor/extensions'
import { markdownToDoc, textToDoc, type TiptapDoc, type TiptapNode } from './convert'
import { ImportError, MAX_IMPORT_BYTES, readImportFile, titleFromFileName, validateFile } from './importFile'

// Exactly the editor's schema (shared extension list), so these tests catch anything it rejects.
const schema = getSchema(createExtensions())

/** Throws if the JSON is not a valid document for the editor's schema. */
function assertValid(doc: TiptapDoc) {
  PMNode.fromJSON(schema, doc).check()
}

const text = (t: string, ...marks: string[]): TiptapNode =>
  marks.length ? { type: 'text', text: t, marks: marks.map((type) => ({ type })) } : { type: 'text', text: t }
const link = (t: string, href: string, ...marks: string[]): TiptapNode => ({
  type: 'text',
  text: t,
  marks: [...marks.map((type) => ({ type })), { type: 'link', attrs: { href } }],
})
const p = (...content: TiptapNode[]): TiptapNode => ({ type: 'paragraph', content })
const li = (...content: TiptapNode[]): TiptapNode => ({ type: 'listItem', content })

describe('textToDoc', () => {
  it('splits paragraphs on blank lines and keeps single line breaks', () => {
    const doc = textToDoc('First line\nsecond line\n\n\nNew paragraph\r\n\r\nThird')
    expect(doc.content).toEqual([
      p(text('First line'), { type: 'hardBreak' }, text('second line')),
      p(text('New paragraph')),
      p(text('Third')),
    ])
    assertValid(doc)
  })

  it('keeps markdown-like and HTML-like text literal', () => {
    const doc = textToDoc('# not a heading\n<script>alert(1)</script>')
    expect(doc.content).toEqual([p(text('# not a heading'), { type: 'hardBreak' }, text('<script>alert(1)</script>'))])
    assertValid(doc)
  })
})

describe('markdownToDoc', () => {
  it('converts headings H1–H3 and caps deeper levels at H3', () => {
    const doc = markdownToDoc('# One\n## Two\n### Three\n#### Four\nSetext\n===\nSub\n---')
    expect(doc.content.map((n) => [n.type, n.attrs?.level, n.content?.[0]?.text])).toEqual([
      ['heading', 1, 'One'],
      ['heading', 2, 'Two'],
      ['heading', 3, 'Three'],
      ['heading', 3, 'Four'],
      ['heading', 1, 'Setext'],
      ['heading', 2, 'Sub'],
    ])
    assertValid(doc)
  })

  it('converts bold, italic, bold-italic and inline code', () => {
    const doc = markdownToDoc('Some **bold**, __also bold__, *italic*, _ital_, ***both*** and `code`.')
    expect(doc.content[0]!.content).toEqual([
      text('Some '),
      text('bold', 'bold'),
      text(', '),
      text('also bold', 'bold'),
      text(', '),
      text('italic', 'italic'),
      text(', '),
      text('ital', 'italic'),
      text(', '),
      text('both', 'bold', 'italic'),
      text(' and '),
      text('code', 'code'),
      text('.'),
    ])
    assertValid(doc)
  })

  it('supports nested emphasis and leaves unmatched or intraword markers alone', () => {
    const doc = markdownToDoc('**bold *and italic***\n\n2 * 3 * 4 and snake_case_name and a lone **')
    expect(doc.content[0]!.content).toEqual([text('bold ', 'bold'), text('and italic', 'bold', 'italic')])
    expect(doc.content[1]!.content).toEqual([text('2 * 3 * 4 and snake_case_name and a lone **')])
    assertValid(doc)
  })

  it('converts bullet and numbered lists, including nesting and start numbers', () => {
    const md = ['- Apples', '- Pears', '  - Green', '  - Red', '* Plums', '', '3. Third', '4. Fourth'].join('\n')
    const doc = markdownToDoc(md)
    expect(doc.content).toEqual([
      {
        type: 'bulletList',
        content: [
          li(p(text('Apples'))),
          li(p(text('Pears')), { type: 'bulletList', content: [li(p(text('Green'))), li(p(text('Red')))] }),
          li(p(text('Plums'))),
        ],
      },
      { type: 'orderedList', attrs: { start: 3 }, content: [li(p(text('Third'))), li(p(text('Fourth')))] },
    ])
    assertValid(doc)
  })

  it('joins soft-wrapped lines into one paragraph and honours hard breaks', () => {
    const doc = markdownToDoc('This is one\nparagraph.  \nAfter a hard break\\\nand another.')
    expect(doc.content).toEqual([
      p(text('This is one paragraph.'), { type: 'hardBreak' }, text('After a hard break'), { type: 'hardBreak' }, text('and another.')),
    ])
    assertValid(doc)
  })

  it('handles blockquotes, code fences, rules, links, images and escapes', () => {
    const md = [
      '> Quoted **text**',
      '',
      '```js',
      'const x = 1 // *not italic*',
      '```',
      '',
      '---',
      '',
      'See [the docs](https://example.com) and ![logo](a.png). \\*not italic\\*',
    ].join('\n')
    const doc = markdownToDoc(md)
    expect(doc.content[0]).toEqual({ type: 'blockquote', content: [p(text('Quoted '), text('text', 'bold'))] })
    expect(doc.content[1]).toEqual({
      type: 'codeBlock',
      attrs: { language: 'js' },
      content: [text('const x = 1 // *not italic*')],
    })
    expect(doc.content[2]).toEqual({ type: 'horizontalRule' })
    expect(doc.content[3]).toEqual(
      p(text('See '), link('the docs', 'https://example.com'), text(' and logo. *not italic*')),
    )
    assertValid(doc)
  })

  it('never interprets HTML', () => {
    const doc = markdownToDoc('<img src=x onerror="alert(1)">\n\n<b>bold?</b>')
    expect(doc.content).toEqual([p(text('<img src=x onerror="alert(1)">')), p(text('<b>bold?</b>'))])
    assertValid(doc)
  })

  it('produces schema-valid output for malformed or unusual input', () => {
    const samples = [
      '#',
      '# ',
      '-',
      '1.',
      '```',
      '>',
      '****',
      '** **',
      '[]()',
      '- [ ] task\n- [x] done',
      '  - starts indented\n- then less',
      '1. a\n- b\n2. c',
      '﻿# BOM heading',
      'line\n===\n===',
      '*a **b* c**',
      '\u0007 control chars \u001b',
    ]
    for (const md of samples) assertValid(markdownToDoc(md))
  })
})

describe('markdownToDoc: GFM tables', () => {
  const cell = (type: 'tableHeader' | 'tableCell', ...content: TiptapNode[]): TiptapNode => ({
    type,
    content: [content.length ? p(...content) : { type: 'paragraph' }],
  })

  it('converts a pipe table into header and body rows with inline formatting', () => {
    const md = ['| Name | Role |', '| :--- | ---: |', '| **Ada** | Engineer |', '| Bob | `ops` \\| infra |'].join('\n')
    const doc = markdownToDoc(md)
    expect(doc.content).toEqual([
      {
        type: 'table',
        content: [
          { type: 'tableRow', content: [cell('tableHeader', text('Name')), cell('tableHeader', text('Role'))] },
          { type: 'tableRow', content: [cell('tableCell', text('Ada', 'bold')), cell('tableCell', text('Engineer'))] },
          { type: 'tableRow', content: [cell('tableCell', text('Bob')), cell('tableCell', text('ops', 'code'), text(' | infra'))] },
        ],
      },
    ])
    assertValid(doc)
  })

  it('pads short rows, drops extra cells, and supports tables without outer pipes', () => {
    const doc = markdownToDoc('a | b | c\n--|--|--\n1 | 2\n1 | 2 | 3 | 4\n\nAfter')
    const rows = doc.content[0]!.content!
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.content!.length === 3)).toBe(true)
    expect(rows[1]!.content![2]).toEqual(cell('tableCell'))
    expect(doc.content[1]).toEqual(p(text('After')))
    assertValid(doc)
  })

  it('does not treat a pipe in normal text as a table', () => {
    const doc = markdownToDoc('a | b\nnot a delimiter')
    expect(doc.content.map((n) => n.type)).toEqual(['paragraph'])
  })
})

describe('markdownToDoc: code, links, tasks, strike, quotes, rules', () => {
  it('keeps fenced code content verbatim with its language (``` and ~~~)', () => {
    const md = ['```Python', 'def f(x):', '    return x * 2  # **not bold**', '```', '', '~~~', '<b>raw</b>', '~~~'].join('\n')
    const doc = markdownToDoc(md)
    expect(doc.content).toEqual([
      { type: 'codeBlock', attrs: { language: 'python' }, content: [text('def f(x):\n    return x * 2  # **not bold**')] },
      { type: 'codeBlock', attrs: { language: null }, content: [text('<b>raw</b>')] },
    ])
    assertValid(doc)
  })

  it('treats an unclosed fence as code to the end of the file', () => {
    const doc = markdownToDoc('```ts\nconst a = 1\n\nconst b = 2')
    expect(doc.content).toEqual([{ type: 'codeBlock', attrs: { language: 'ts' }, content: [text('const a = 1\n\nconst b = 2')] }])
  })

  it('creates link marks only for safe URLs', () => {
    const doc = markdownToDoc(
      '[site](https://example.com) [mail](mailto:a@example.com) [bad](javascript:alert(1)) [data](data:text/html,x) [rel](./a.md) <https://auto.example.com> see https://bare.example.com/path.',
    )
    const nodes = doc.content[0]!.content!
    expect(nodes.slice(0, 3)).toEqual([link('site', 'https://example.com'), text(' '), link('mail', 'mailto:a@example.com')])
    const hrefs = nodes.flatMap((n) => n.marks?.filter((m) => m.type === 'link').map((m) => m.attrs!.href) ?? [])
    expect(hrefs).toEqual(['https://example.com', 'mailto:a@example.com', 'https://auto.example.com', 'https://bare.example.com/path'])
    const plain = nodes.map((n) => n.text).join('')
    expect(plain).not.toContain('javascript:')
    expect(plain).not.toContain('data:')
    expect(plain).toContain('rel') // label kept, unsafe/relative target dropped
    expect(plain.endsWith('path.')).toBe(true) // trailing period is not part of the URL
    assertValid(doc)
  })

  it('combines link marks with emphasis', () => {
    const doc = markdownToDoc('**[bold link](https://example.com)**')
    expect(doc.content[0]!.content).toEqual([link('bold link', 'https://example.com', 'bold')])
    assertValid(doc)
  })

  it('converts task lists with checked states and nesting; mixed lists stay bullet lists', () => {
    const doc = markdownToDoc('- [ ] Todo\n- [x] Done\n  - [X] Sub done\n\n---\n\n- [ ] task\n- plain')
    expect(doc.content[0]).toEqual({
      type: 'taskList',
      content: [
        { type: 'taskItem', attrs: { checked: false }, content: [p(text('Todo'))] },
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [p(text('Done')), { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [p(text('Sub done'))] }] }],
        },
      ],
    })
    expect(doc.content[2]).toEqual({ type: 'bulletList', content: [li(p(text('[ ] task'))), li(p(text('plain')))] })
    assertValid(doc)
  })

  it('converts ~~strikethrough~~', () => {
    const doc = markdownToDoc('Not ~~this~~ but ~~**that**~~; a lone ~ stays.')
    expect(doc.content[0]!.content).toEqual([
      text('Not '),
      text('this', 'strike'),
      text(' but '),
      text('that', 'strike', 'bold'),
      text('; a lone ~ stays.'),
    ])
    assertValid(doc)
  })

  it('supports nested blockquotes, lists inside quotes and lazy continuation', () => {
    const doc = markdownToDoc('> Outer line\ncontinued lazily\n>\n> > Inner\n>\n> - item')
    expect(doc.content).toEqual([
      {
        type: 'blockquote',
        content: [
          p(text('Outer line continued lazily')),
          { type: 'blockquote', content: [p(text('Inner'))] },
          { type: 'bulletList', content: [li(p(text('item')))] },
        ],
      },
    ])
    assertValid(doc)
  })

  it('converts all horizontal rule spellings', () => {
    const doc = markdownToDoc('---\n\n***\n\n___\n\n- - -')
    expect(doc.content).toEqual(Array(4).fill({ type: 'horizontalRule' }))
    assertValid(doc)
  })
})

describe('file validation', () => {
  const file = (content: BlobPart[], name: string) => new File(content, name)

  it('accepts .txt and .md, case-insensitively', () => {
    expect(() => validateFile(file(['hi'], 'notes.txt'))).not.toThrow()
    expect(() => validateFile(file(['hi'], 'README.MD'))).not.toThrow()
  })

  it('rejects unsupported extensions, empty and oversized files', () => {
    expect(() => validateFile(file(['x'], 'report.docx'))).toThrow(/“.docx” files aren’t supported/)
    expect(() => validateFile(file(['x'], 'Makefile'))).toThrow(/no extension/)
    expect(() => validateFile(file([], 'empty.txt'))).toThrow(/empty/)
    expect(() => validateFile(file([new Uint8Array(MAX_IMPORT_BYTES + 1)], 'big.txt'))).toThrow(/limit is 2.0 MB/)
    expect(() => validateFile(file([new Uint8Array(MAX_IMPORT_BYTES)], 'max.txt'))).not.toThrow()
  })

  it('rejects whitespace-only, binary and non-UTF-8 files', async () => {
    await expect(readImportFile(file(['  \n\n\t '], 'blank.md'))).rejects.toThrow(/empty/)
    await expect(readImportFile(file([new Uint8Array([72, 0, 105])], 'bin.txt'))).rejects.toThrow(/binary/)
    await expect(readImportFile(file([new Uint8Array([0xff, 0xfe, 0x41])], 'latin.txt'))).rejects.toThrow(/UTF-8/)
    await expect(readImportFile(file(['x'], 'x.pdf'))).rejects.toBeInstanceOf(ImportError)
  })

  it('reads a markdown file into a titled document', async () => {
    const result = await readImportFile(file(['﻿# Plan\n\n- one\n- two'], 'Q4 plan.md'))
    expect(result.title).toBe('Q4 plan')
    expect(result.content.content.map((n) => n.type)).toEqual(['heading', 'bulletList'])
    assertValid(result.content)
  })

  it('derives titles from file names', () => {
    expect(titleFromFileName('meeting-notes.v2.md')).toBe('meeting-notes.v2')
    expect(titleFromFileName('.md')).toBe('Imported document')
    expect(titleFromFileName(`${'a'.repeat(300)}.txt`)).toHaveLength(200)
  })
})
