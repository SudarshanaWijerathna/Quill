import { expect, test, type Browser, type Page } from '@playwright/test'

const PASSWORD = 'quill-demo-123'

async function login(page: Page, email = 'alice@example.com') {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', PASSWORD)
  await page.click('button[type=submit]')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Good')
}

async function newDoc(page: Page, title: string) {
  const res = await page.request.post('/api/documents', { data: { title } })
  const id = (await res.json()).id as string
  await page.goto(`/documents/${id}`)
  await editor(page).click()
  return id
}

const editor = (page: Page) => page.locator('.ProseMirror')
const tool = (page: Page, name: string) => page.getByRole('toolbar', { name: 'Formatting' }).getByRole('button', { name, exact: true })
const expectSaved = (page: Page) =>
  expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 10_000 })
const stored = async (page: Page, id: string) => (await (await page.request.get(`/api/documents/${id}`)).json()).content
const types = (content: unknown) => JSON.stringify(content)

test.describe('rich content editing', () => {
  test.beforeEach(async ({ page }) => login(page))

  test('tables: insert, edit cells, add/delete rows and columns, header row; persists', async ({ page }) => {
    const id = await newDoc(page, 'Table test')
    await tool(page, 'Insert table').click()
    const table = editor(page).locator('table')
    await expect(table.locator('tr')).toHaveCount(3)
    await expect(table.locator('th')).toHaveCount(3)

    await page.keyboard.type('Name')
    await page.keyboard.press('Tab')
    await page.keyboard.type('Role')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab') // first body cell
    await page.keyboard.type('Ada')
    await page.keyboard.press('Tab')
    await page.keyboard.type('Engineer')

    const tableMenu = async (item: string) => {
      await page.getByRole('button', { name: 'Table options' }).click()
      await page.getByRole('menuitem', { name: item }).click()
    }
    // Row/column commands act on the cell containing the cursor.
    await tableMenu('Insert column right') // cursor is in the "Role" column
    await expect(table.locator('tr').first().locator('th')).toHaveCount(4)
    await expect(table.locator('tr').first().locator('th').nth(2)).toHaveText('') // new, empty column
    await table.locator('tr').first().locator('th').nth(2).click()
    await tableMenu('Delete column')
    await expect(table.locator('tr').first().locator('th')).toHaveCount(3)

    await table.locator('tr').nth(1).locator('td').first().click() // "Ada" row
    await tableMenu('Insert row below')
    await expect(table.locator('tr')).toHaveCount(4)
    await table.locator('tr').nth(2).locator('td').first().click() // the new, empty row
    await tableMenu('Delete row')
    await expect(table.locator('tr')).toHaveCount(3)

    await tableMenu('Toggle header row')
    await expect(table.locator('th')).toHaveCount(0)
    await tableMenu('Toggle header row')
    await expect(table.locator('th')).toHaveCount(3)

    await expectSaved(page)
    await page.reload()
    await expect(table.locator('th')).toHaveText(['Name', 'Role', ''])
    await expect(table.locator('tr').nth(1).locator('td').first()).toHaveText('Ada')
    await expect(table.locator('tr').nth(1).locator('td').nth(1)).toHaveText('Engineer')

    // Cells are still editable after reload
    await table.locator('td').first().click()
    await page.keyboard.press('End')
    await page.keyboard.type(' L.')
    await expectSaved(page)
    await page.reload()
    await expect(table.locator('td').first()).toHaveText('Ada L.')
    expect(types(await stored(page, id))).toContain('"tableHeader"')
  })

  test('code blocks keep content and language, with syntax highlighting; inline code works', async ({ page }) => {
    const id = await newDoc(page, 'Code test')
    await page.keyboard.type('Use ')
    await page.keyboard.press('ControlOrMeta+e')
    await page.keyboard.type('npm test')
    await page.keyboard.press('ControlOrMeta+e')
    await page.keyboard.press('Enter')

    await tool(page, 'Code block').click()
    await page.keyboard.type('const answer: number = 42 // the answer')
    await page.getByRole('button', { name: 'Code language' }).click()
    await page.getByRole('menuitem', { name: 'TypeScript', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Code language' })).toHaveText(/TypeScript/)

    await expectSaved(page)
    await page.reload()
    const code = editor(page).locator('pre code')
    await expect(code).toHaveText('const answer: number = 42 // the answer')
    await expect(code).toHaveClass(/language-typescript/)
    await expect(code.locator('.hljs-keyword').first()).toHaveText('const')
    await expect(code.locator('.hljs-comment')).toHaveText('// the answer')
    await expect(editor(page).locator('p code')).toHaveText('npm test')

    const content = await stored(page, id)
    const block = content.content.find((n: { type: string }) => n.type === 'codeBlock')
    expect(block.attrs.language).toBe('typescript')
    expect(block.content[0].text).toBe('const answer: number = 42 // the answer')
  })

  test('links: insert via dialog, reject unsafe URLs, edit, remove; persists', async ({ page }) => {
    const id = await newDoc(page, 'Link test')
    await page.keyboard.type('Visit Quill')
    await page.keyboard.press('Shift+Home')
    await tool(page, 'Insert link').click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Address').fill('javascript:alert(1)')
    await dialog.getByRole('button', { name: 'Insert' }).click()
    await expect(dialog.getByRole('alert')).toContainText('Other link types aren’t allowed')

    await dialog.getByLabel('Address').fill('example.com/docs')
    await dialog.getByRole('button', { name: 'Insert' }).click()
    const anchor = editor(page).locator('a')
    await expect(anchor).toHaveText('Visit Quill')
    await expect(anchor).toHaveAttribute('href', 'https://example.com/docs')

    // Edit (Ctrl/Cmd+K with the cursor inside the link)
    await anchor.click()
    await page.keyboard.press('ControlOrMeta+k')
    await expect(dialog.getByLabel('Address')).toHaveValue('https://example.com/docs')
    await dialog.getByLabel('Address').fill('https://quill.example.org')
    await dialog.getByRole('button', { name: 'Update' }).click()
    await expect(anchor).toHaveAttribute('href', 'https://quill.example.org')

    // Remove
    await anchor.click()
    await tool(page, 'Edit link').click()
    await dialog.getByRole('button', { name: 'Remove link' }).click()
    await expect(editor(page).locator('a')).toHaveCount(0)
    await expect(editor(page)).toContainText('Visit Quill')

    // Insert with no selection: the dialog asks for display text
    await page.keyboard.press('End')
    await page.keyboard.type(' ')
    await page.keyboard.press('ControlOrMeta+k')
    await dialog.getByLabel('Address').fill('mailto:team@example.com')
    await dialog.getByLabel('Text to display').fill('Email us')
    await dialog.getByRole('button', { name: 'Insert' }).click()

    await expectSaved(page)
    await page.reload()
    const mail = editor(page).locator('a')
    await expect(mail).toHaveText('Email us')
    await expect(mail).toHaveAttribute('href', 'mailto:team@example.com')
    await expect(mail).toHaveAttribute('rel', /noopener/)
    expect(types(await stored(page, id))).toContain('"href":"mailto:team@example.com"')
  })

  test('task lists: interactive checkboxes; checked state persists', async ({ page }) => {
    const id = await newDoc(page, 'Tasks test')
    await tool(page, 'Checklist').click()
    await page.keyboard.type('Write tests')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Ship it')
    const boxes = editor(page).locator('ul[data-type="taskList"] input[type="checkbox"]')
    await expect(boxes).toHaveCount(2)
    await boxes.first().check()
    // (the <label> holds a visually hidden screen-reader text, so check the content <div>)
    await expect(editor(page).locator('li[data-checked="true"] > div')).toHaveText('Write tests')

    await expectSaved(page)
    await page.reload()
    await expect(boxes.first()).toBeChecked()
    await expect(boxes.nth(1)).not.toBeChecked()
    const items = (await stored(page, id)).content[0].content
    expect(items.map((i: { attrs: { checked: boolean } }) => i.attrs.checked)).toEqual([true, false])
  })

  test('strikethrough, blockquote and divider; persists', async ({ page }) => {
    await newDoc(page, 'Blocks test')
    await tool(page, 'Strikethrough').click()
    await page.keyboard.type('obsolete')
    await tool(page, 'Strikethrough').click()
    await page.keyboard.press('Enter')
    await tool(page, 'Quote').click()
    await page.keyboard.type('A wise quote')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter') // leave the quote
    await tool(page, 'Divider').click()
    await page.keyboard.type('After the line')

    await expectSaved(page)
    await page.reload()
    await expect(editor(page).locator('s')).toHaveText('obsolete')
    await expect(editor(page).locator('blockquote')).toHaveText('A wise quote')
    await expect(editor(page).locator('hr')).toHaveCount(1)
    await expect(editor(page)).toContainText('After the line')
  })

  test('existing (pre-upgrade) documents still open and save', async ({ page }) => {
    // Content in the shape the earlier editor version stored (codeBlock without language attr, etc.)
    const legacy = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Legacy doc' }] },
        { type: 'codeBlock', content: [{ type: 'text', text: 'old code' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }] }] },
      ],
    }
    const res = await page.request.post('/api/documents', { data: { title: 'Legacy', content: legacy } })
    const id = (await res.json()).id
    await page.goto(`/documents/${id}`)
    await expect(editor(page).locator('h1')).toHaveText('Legacy doc')
    await expect(editor(page).locator('pre code')).toHaveText('old code')
    await expect(page.getByRole('alert')).toHaveCount(0) // no "content Quill can't display" banner
    await editor(page).locator('li').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' edited')
    await expectSaved(page)
    expect(types(await stored(page, id))).toContain('item edited')
  })
})

const RICH_MARKDOWN = [
  '# Release notes',
  '',
  '| Feature | Status |',
  '| --- | --- |',
  '| Tables | **done** |',
  '| Links | ~~todo~~ done |',
  '',
  '```python',
  'def hello():',
  '    return "hi"',
  '```',
  '',
  'Read [the guide](https://example.com/guide) or [bad](javascript:alert(1)).',
  '',
  '- [x] Ship tables',
  '- [ ] Ship comments',
  '',
  '> Quoted wisdom',
  '',
  '---',
  '',
  '<img src=x onerror="window.__xss = 1">',
].join('\n')

async function importMarkdown(page: Page, name: string, markdown: string) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await page.getByTestId('import-file-input').setInputFiles({ name, mimeType: 'text/markdown', buffer: Buffer.from(markdown) })
  await page.getByRole('dialog').getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page).toHaveURL(/\/documents\//)
  return page.url().split('/').pop()!
}

test('Markdown import creates editable tables, code, links, tasks, strike, quotes and rules', async ({ page }) => {
  await login(page)
  const id = await importMarkdown(page, 'release.md', RICH_MARKDOWN)
  const ed = editor(page)

  const check = async () => {
    await expect(ed.locator('th')).toHaveText(['Feature', 'Status'])
    await expect(ed.locator('tr').nth(1).locator('td strong')).toHaveText('done')
    await expect(ed.locator('td s')).toHaveText('todo')
    await expect(ed.locator('pre code')).toHaveClass(/language-python/)
    await expect(ed.locator('pre code .hljs-keyword').first()).toHaveText('def')
    await expect(ed.locator('a')).toHaveCount(1) // the javascript: link was not created
    await expect(ed.locator('a')).toHaveAttribute('href', 'https://example.com/guide')
    await expect(ed).not.toContainText('javascript:')
    const boxes = ed.locator('ul[data-type="taskList"] input[type="checkbox"]')
    await expect(boxes.first()).toBeChecked()
    await expect(boxes.nth(1)).not.toBeChecked()
    await expect(ed.locator('blockquote')).toHaveText('Quoted wisdom')
    await expect(ed.locator('hr')).toHaveCount(1)
    await expect(ed.locator('img')).toHaveCount(0) // HTML is text, not markup
    await expect(ed).toContainText('<img src=x onerror="window.__xss = 1">')
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  }
  await check()

  // Imported structures are editable: edit a table cell and tick a task
  await ed.locator('tr').nth(1).locator('td').first().click()
  await page.keyboard.press('End')
  await page.keyboard.type(' (v2)')
  await ed.locator('ul[data-type="taskList"] input[type="checkbox"]').nth(1).check()
  await expectSaved(page)
  await page.reload()
  await expect(ed.locator('tr').nth(1).locator('td').first()).toHaveText('Tables (v2)')
  await expect(ed.locator('ul[data-type="taskList"] input[type="checkbox"]').nth(1)).toBeChecked()

  const content = await stored(page, id)
  expect(content.content.map((n: { type: string }) => n.type)).toEqual([
    'heading', 'table', 'codeBlock', 'paragraph', 'taskList', 'blockquote', 'horizontalRule', 'paragraph',
  ])
})

async function loginInNewContext(browser: Browser, email: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await login(page, email)
  return page
}

test('viewers cannot change rich content (checkboxes, tables) and links stay clickable', async ({ browser }) => {
  const alice = await loginInNewContext(browser, 'alice@example.com')
  const id = await importMarkdown(alice, 'shared-rich.md', RICH_MARKDOWN)
  await alice.request.post(`/api/documents/${id}/shares`, { data: { email: 'bob@example.com', permission: 'viewer' } })

  const bob = await loginInNewContext(browser, 'bob@example.com')
  let patches = 0
  bob.on('request', (r) => r.method() === 'PATCH' && patches++)
  await bob.goto(`/documents/${id}`)
  const ed = editor(bob)
  await expect(ed).toHaveAttribute('contenteditable', 'false')
  await expect(bob.getByRole('toolbar', { name: 'Formatting' })).toHaveAttribute('aria-disabled', 'true')
  await expect(bob.getByRole('button', { name: 'Bold', exact: true })).toBeDisabled()

  const unchecked = ed.locator('ul[data-type="taskList"] input[type="checkbox"]').nth(1)
  await expect(unchecked).not.toBeChecked()
  await unchecked.click({ force: true })
  await expect(unchecked).not.toBeChecked() // reverted in read-only mode

  await ed.locator('td').first().click()
  await bob.keyboard.type('viewer edit')
  await expect(ed).not.toContainText('viewer edit')

  await expect(ed.locator('a')).toHaveAttribute('href', 'https://example.com/guide')
  await expect(ed.locator('a')).toHaveAttribute('target', '_blank')

  await bob.waitForTimeout(1200)
  expect(patches).toBe(0)
  const content = types(await stored(alice, id))
  expect(content).not.toContain('viewer edit')
})
