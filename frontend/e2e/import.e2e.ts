import { expect, test, type Page } from '@playwright/test'

const PASSWORD = 'quill-demo-123'

async function login(page: Page, email = 'alice@example.com') {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', PASSWORD)
  await page.click('button[type=submit]')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Good')
}

const editor = (page: Page) => page.locator('.ProseMirror')
const fileInput = (page: Page) => page.getByTestId('import-file-input')
const importButton = (page: Page) => page.getByRole('dialog').getByRole('button', { name: 'Import', exact: true })

async function openImport(page: Page) {
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('.txt or .md · up to 2.0 MB')
}

function file(name: string, content: string | Buffer, mimeType = 'text/plain') {
  return { name, mimeType, buffer: typeof content === 'string' ? Buffer.from(content, 'utf-8') : content }
}

const MARKDOWN = [
  '# Project Atlas',
  '',
  'An **important** plan with *emphasis* and <b>raw html</b>.',
  '',
  '## Goals',
  '',
  '- Ship the editor',
  '- Add sharing',
  '  - Viewer role',
  '',
  '### Steps',
  '',
  '1. Design',
  '2. Build',
  '3. Test',
].join('\n')

test.beforeEach(async ({ page }) => login(page))

test('imports a .txt file as a new document, preserving paragraphs, and it persists', async ({ page }) => {
  await openImport(page)
  await fileInput(page).setInputFiles(file('Meeting notes.txt', 'First paragraph line one\nline two\n\nSecond paragraph\n\n\nThird # not a heading'))
  await expect(page.getByTestId('import-selected-file')).toContainText('Meeting notes.txt')
  await importButton(page).click()

  await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}$/)
  await expect(page.getByLabel('Document title')).toHaveValue('Meeting notes')
  await expect(editor(page).locator('p')).toHaveCount(3)
  await expect(editor(page).locator('p').first().locator('br')).toHaveCount(1)
  await expect(editor(page).locator('h1')).toHaveCount(0) // "#" in a .txt stays literal

  await page.reload()
  await expect(editor(page).locator('p')).toHaveText(['First paragraph line oneline two', 'Second paragraph', 'Third # not a heading'])
})

test('imports Markdown with headings, emphasis and lists; HTML stays literal; persists after refresh', async ({ page }) => {
  await openImport(page)
  await fileInput(page).setInputFiles(file('atlas.md', MARKDOWN, 'text/markdown'))
  await importButton(page).click()
  await expect(page).toHaveURL(/\/documents\//)
  const id = page.url().split('/').pop()!

  const check = async () => {
    const ed = editor(page)
    await expect(ed.locator('h1')).toHaveText('Project Atlas')
    await expect(ed.locator('h2')).toHaveText('Goals')
    await expect(ed.locator('h3')).toHaveText('Steps')
    await expect(ed.locator('strong')).toHaveText('important')
    await expect(ed.locator('em')).toHaveText('emphasis')
    await expect(ed.locator('b')).toHaveCount(0) // raw <b> was not rendered as HTML
    await expect(ed).toContainText('<b>raw html</b>')
    // Top-level list items only (".ProseMirror > ul"); the nested list is checked separately.
    await expect(page.locator('.ProseMirror > ul > li')).toHaveCount(2)
    await expect(ed.locator('ul ul > li')).toHaveText(['Viewer role'])
    await expect(ed.locator('ol > li')).toHaveText(['Design', 'Build', 'Test'])
  }
  await check()
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved')
  await page.reload()
  await check()

  // Stored as structured Tiptap JSON
  const stored = await (await page.request.get(`/api/documents/${id}`)).json()
  expect(stored.title).toBe('atlas')
  expect(stored.content.content.map((n: { type: string }) => n.type)).toEqual([
    'heading', 'paragraph', 'heading', 'bulletList', 'heading', 'orderedList',
  ])
})

test('rejects unsupported, empty, whitespace-only and oversized files with clear errors', async ({ page }) => {
  await openImport(page)
  const dialog = page.getByRole('dialog')

  await fileInput(page).setInputFiles(file('report.docx', 'PK...', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))
  await expect(dialog.getByRole('alert')).toContainText('“.docx” files aren’t supported')
  await expect(importButton(page)).toBeDisabled()

  await fileInput(page).setInputFiles(file('empty.txt', ''))
  await expect(dialog.getByRole('alert')).toContainText('This file is empty')
  await expect(importButton(page)).toBeDisabled()

  await fileInput(page).setInputFiles(file('big.md', Buffer.alloc(2 * 1024 * 1024 + 1, 'a')))
  await expect(dialog.getByRole('alert')).toContainText('The limit is 2.0 MB')
  await expect(importButton(page)).toBeDisabled()

  // Whitespace-only passes the quick checks but is rejected when read
  await fileInput(page).setInputFiles(file('blank.md', '   \n\n  '))
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await importButton(page).click()
  await expect(dialog.getByRole('alert')).toContainText('This file is empty')

  // Nothing was created
  await page.keyboard.press('Escape')
  const docs = await (await page.request.get('/api/documents')).json()
  expect(docs.map((d: { title: string }) => d.title)).not.toContain('blank')
})

test('repeated clicks create only one document', async ({ page }) => {
  let posts = 0
  await page.route('**/api/documents', async (route) => {
    if (route.request().method() === 'POST') {
      posts++
      await new Promise((r) => setTimeout(r, 600)) // slow server
    }
    await route.continue()
  })
  await openImport(page)
  await fileInput(page).setInputFiles(file('once.txt', 'Only once'))
  // Two synchronous clicks, before React can re-render the disabled state
  await importButton(page).evaluate((el: HTMLButtonElement) => {
    el.click()
    el.click()
  })
  await expect(page).toHaveURL(/\/documents\//)
  expect(posts).toBe(1)
})

test('supports drag and drop', async ({ page }) => {
  await openImport(page)
  const dataTransfer = await page.evaluateHandle(() => {
    const dt = new DataTransfer()
    dt.items.add(new File(['# Dropped\n\nHello'], 'dropped.md', { type: 'text/markdown' }))
    return dt
  })
  await page.getByTestId('import-dropzone').dispatchEvent('drop', { dataTransfer })
  await expect(page.getByTestId('import-selected-file')).toContainText('dropped.md')
  await importButton(page).click()
  await expect(editor(page).locator('h1')).toHaveText('Dropped')
})

test('imported documents belong to the importing user only', async ({ page, browser }) => {
  await openImport(page)
  await fileInput(page).setInputFiles(file('alice-private.md', '# Private'))
  await importButton(page).click()
  await expect(page).toHaveURL(/\/documents\//)
  const id = page.url().split('/').pop()!

  const doc = await (await page.request.get(`/api/documents/${id}`)).json()
  expect(doc.role).toBe('owner')
  expect(doc.owner.email).toBe('alice@example.com')

  const bobContext = await browser.newContext()
  const bob = await bobContext.newPage()
  await login(bob, 'bob@example.com')
  expect((await bob.request.get(`/api/documents/${id}`)).status()).toBe(404)
  const bobDocs = await (await bob.request.get('/api/documents')).json()
  expect(bobDocs.map((d: { id: string }) => d.id)).not.toContain(id)
  await bobContext.close()
})
