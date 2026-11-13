import { readFile } from 'node:fs/promises'
import { expect, test, type Browser, type Page } from '@playwright/test'

const PASSWORD = 'quill-demo-123'

async function login(page: Page, email = 'alice@example.com') {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', PASSWORD)
  await page.click('button[type=submit]')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Good')
}

async function userPage(browser: Browser, email: string) {
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()
  await login(page, email)
  return page
}

const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const RICH = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Quarterly plan' }] },
    { type: 'paragraph', content: [
      { type: 'text', text: 'Ship ' },
      { type: 'text', text: 'faster', marks: [{ type: 'bold' }] },
      { type: 'text', text: ' with ' },
      { type: 'text', text: 'links', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
    ] },
    { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [p('Done item')] }] },
    { type: 'table', content: [
      { type: 'tableRow', content: [{ type: 'tableHeader', content: [p('Feature')] }, { type: 'tableHeader', content: [p('Status')] }] },
      { type: 'tableRow', content: [{ type: 'tableCell', content: [p('Export')] }, { type: 'tableCell', content: [p('done')] }] },
    ] },
    { type: 'codeBlock', attrs: { language: 'python' }, content: [{ type: 'text', text: 'print("hi")' }] },
  ],
}

async function createDoc(page: Page, title: string, content: unknown = RICH) {
  const res = await page.request.post('/api/documents', { data: { title, content } })
  expect(res.status()).toBe(201)
  return (await res.json()).id as string
}

const editor = (page: Page) => page.locator('.ProseMirror')
const expectSaved = (page: Page) =>
  expect(page.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 10_000 })

async function openFileMenu(page: Page) {
  await page.getByRole('button', { name: 'File menu' }).click()
}

async function downloadVia(page: Page, item: RegExp) {
  await openFileMenu(page)
  await page.getByRole('menuitem', { name: 'Download' }).hover()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: item }).click()])
  return { name: download.suggestedFilename(), text: await readFile((await download.path())!, 'utf-8') }
}

// ---- Theme, logo, favicon ------------------------------------------------------------------------

test('theme toggle persists across refreshes and pages', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await login(page)
  const html = page.locator('html')
  await expect(html).not.toHaveClass(/dark/)

  await page.getByTestId('theme-toggle').click()
  await expect(html).toHaveClass(/dark/)
  expect(await page.evaluate(() => localStorage.getItem('quill-theme'))).toBe('dark')

  await page.reload()
  await expect(html).toHaveClass(/dark/)
  const id = await createDoc(page, 'Theme doc')
  await page.goto(`/documents/${id}`)
  await expect(html).toHaveClass(/dark/)
  // Dark theme actually changes the surface colour (not just the class)
  const bg = await page.locator('header').first().evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(bg).not.toBe('rgb(255, 255, 255)')

  await page.getByTestId('theme-toggle').click() // toggle in the editor header
  await expect(html).not.toHaveClass(/dark/)
  await page.reload()
  await expect(html).not.toHaveClass(/dark/)
  expect(await page.evaluate(() => localStorage.getItem('quill-theme'))).toBe('light')
})

test('light mode is the default even when the operating system prefers dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/login')
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  expect(await page.evaluate(() => localStorage.getItem('quill-theme'))).toBeNull()
})

test('quill.svg is the logo on login, dashboard and editor, and the favicon', async ({ page }) => {
  const checkLogo = async () => {
    const mark = page.getByTestId('logo-mark').first()
    await expect(mark).toHaveAttribute('src', '/quill.svg')
    await expect.poll(() => mark.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  }
  await page.goto('/login')
  await checkLogo()
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/quill.svg')
  const icon = await page.request.get('/quill.svg')
  expect(icon.status()).toBe(200)
  expect(icon.headers()['content-type']).toContain('image/svg+xml')

  await page.fill('#email', 'alice@example.com')
  await page.fill('#password', PASSWORD)
  await page.click('button[type=submit]')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Good')
  await checkLogo()
  await page.goto(`/documents/${await createDoc(page, 'Logo doc')}`)
  await checkLogo()
})

// ---- Header layout, zoom, status bar ---------------------------------------------------------------

test('header order: saved status before mode toggle; File menu is on the left', async ({ page }) => {
  await login(page)
  await page.goto(`/documents/${await createDoc(page, 'Header doc')}`)
  const x = async (locator: ReturnType<Page['locator']>) => (await locator.boundingBox())!.x
  const status = await x(page.getByTestId('save-status'))
  const mode = await x(page.getByRole('radiogroup', { name: 'Mode' }))
  const share = await x(page.getByRole('button', { name: 'Share' }))
  const avatar = await x(page.getByTestId('user-avatar'))
  const file = await page.getByRole('button', { name: 'File menu' }).boundingBox()
  const toolbar = await page.getByRole('toolbar', { name: 'Formatting' }).boundingBox()
  expect(status).toBeLessThan(share)
  expect(status).toBeLessThan(mode)
  expect(file!.x + file!.width).toBeLessThanOrEqual(toolbar!.x)
  expect(file!.x).toBeLessThan(1280 / 2)
  expect(share).toBeLessThan(avatar)
  expect(avatar).toBeGreaterThan(1280 / 2) // right half of the header
})

test('zoom changes only the canvas, is clamped to 50–200%, and editing still works when zoomed', async ({ page }) => {
  await login(page)
  const id = await createDoc(page, 'Zoom doc', { type: 'doc', content: [p('Zoom me')] })
  await page.goto(`/documents/${id}`)
  const canvas = page.getByTestId('document-canvas')
  const level = page.getByTestId('zoom-level')
  const toolbarHeight = (await page.getByRole('toolbar', { name: 'Formatting' }).boundingBox())!.height
  const width100 = (await canvas.boundingBox())!.width

  await expect(level).toHaveText('100%')
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(level).toHaveText('110%')
  await expect(canvas).toHaveCSS('zoom', '1.1')
  expect((await canvas.boundingBox())!.width).toBeGreaterThan(width100)
  expect((await page.getByRole('toolbar', { name: 'Formatting' }).boundingBox())!.height).toBe(toolbarHeight)

  for (let i = 0; i < 12; i++) await page.getByRole('button', { name: 'Zoom in' }).click({ force: true })
  await expect(level).toHaveText('200%')
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeDisabled()

  await level.click() // reset
  await expect(level).toHaveText('100%')
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Zoom out' }).click() // 100 → 50
  await expect(level).toHaveText('50%')
  await expect(page.getByRole('button', { name: 'Zoom out' })).toBeDisabled()

  // Click-to-place-cursor and typing work at 150% zoom
  await level.click()
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(level).toHaveText('150%')
  await editor(page).getByText('Zoom me').click()
  await page.keyboard.press('End')
  await page.keyboard.type(' at 150%')
  await expectSaved(page)
  await expect(editor(page)).toContainText('Zoom me at 150%')
  expect(JSON.stringify((await (await page.request.get(`/api/documents/${id}`)).json()).content)).toContain('Zoom me at 150%')
})

test('word count is fixed bottom-right, stays visible, updates, and never covers the text', async ({ page }) => {
  await login(page)
  const long = { type: 'doc', content: Array.from({ length: 80 }, (_, i) => p(`Paragraph number ${i + 1} with some words`)) }
  await page.goto(`/documents/${await createDoc(page, 'Long doc', long)}`)
  const bar = page.getByTestId('status-bar')
  await expect(bar).toHaveCSS('position', 'fixed')
  await expect(page.getByTestId('word-count')).toHaveText('480 words')

  const viewport = page.viewportSize()!
  const check = async () => {
    const box = (await bar.boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
    expect(box.x).toBeGreaterThan(viewport.width / 2)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
    expect(box.y).toBeGreaterThan(viewport.height - 100)
  }
  await check()
  await page.mouse.wheel(0, 100_000) // scroll to the very end
  await page.waitForTimeout(300)
  await check()
  // At the end of the document the last paragraph sits above the status bar
  const last = (await editor(page).locator('p').last().boundingBox())!
  expect(last.y + last.height).toBeLessThanOrEqual((await bar.boundingBox())!.y)

  await editor(page).locator('p').last().click()
  await page.keyboard.press('End')
  await page.keyboard.type(' plus two')
  await expect(page.getByTestId('word-count')).toHaveText('482 words')
})

// ---- Editing / Viewing mode --------------------------------------------------------------------

test('viewing mode is read-only, sends no saves, and editing mode restores the editor', async ({ page }) => {
  await login(page)
  const id = await createDoc(page, 'Mode doc', { type: 'doc', content: [p('Original')] })
  await page.goto(`/documents/${id}`)
  let patches = 0
  page.on('request', (r) => r.method() === 'PATCH' && patches++)

  await page.getByRole('radio', { name: /Viewing/ }).click()
  await expect(editor(page)).toHaveAttribute('contenteditable', 'false')
  await expect(page.getByRole('toolbar', { name: 'Formatting' })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByRole('button', { name: 'Bold', exact: true })).toBeDisabled()
  await expect(page.getByLabel('Document title')).toHaveCount(0)
  await editor(page).click()
  await page.keyboard.type('typed while viewing')
  await page.waitForTimeout(1500) // longer than the autosave debounce
  await expect(editor(page)).not.toContainText('typed while viewing')
  expect(patches).toBe(0)

  await page.getByRole('radio', { name: /Editing/ }).click()
  await expect(editor(page)).toHaveAttribute('contenteditable', 'true')
  await expect(page.getByRole('toolbar', { name: 'Formatting' })).toBeVisible()
  await editor(page).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' edited again')
  await expectSaved(page)
  expect(patches).toBeGreaterThanOrEqual(1)
  await page.reload()
  await expect(editor(page)).toHaveText('Original edited again')
})

// ---- Sharing levels, downloads, copy ---------------------------------------------------------------

test('three sharing levels via the dialog, enforced by the API and reflected in the UI', async ({ browser }) => {
  const alice = await userPage(browser, 'alice@example.com')
  const bob = await userPage(browser, 'bob@example.com')
  const id = await createDoc(alice, 'Levels doc')
  const bobId = (await (await bob.request.get('/api/auth/me')).json()).id

  // Owner shares as "Viewer + download" through the dialog
  await alice.goto(`/documents/${id}`)
  await alice.getByRole('button', { name: 'Share' }).click()
  const dialog = alice.getByRole('dialog')
  await dialog.getByLabel('Email address').fill('bob@example.com')
  await dialog.getByRole('button', { name: 'Permission for new collaborator' }).click()
  await alice.getByRole('menuitem', { name: /Viewer \+ download/ }).click()
  await dialog.getByRole('button', { name: 'Share', exact: true }).click()
  const bobMenu = dialog.getByRole('button', { name: 'Permission for Bob Nguyen' })
  await expect(bobMenu).toHaveText(/Viewer \+ download/)

  // Level 2 — Viewer + download: can download and copy, cannot edit, no mode control
  await bob.goto(`/documents/${id}`)
  await expect(bob.getByTestId('role-badge')).toContainText('View & download')
  await expect(bob.getByRole('radiogroup', { name: 'Mode' })).toHaveCount(0)
  await expect(editor(bob)).toHaveAttribute('contenteditable', 'false')
  const md = await downloadVia(bob, /Markdown/)
  expect(md.name).toBe('Levels doc.md')
  expect(md.text).toContain('# Quarterly plan')
  expect((await bob.request.patch(`/api/documents/${id}`, { data: { content: RICH } })).status()).toBe(403)

  // Level 1 — Viewer: no download (UI disabled, API 403)
  await bobMenu.click()
  await alice.getByRole('menuitem', { name: /^Viewer Can view\. Can’t/ }).click()
  await expect(bobMenu).toHaveText(/^Viewer/)
  await expect(bobMenu).not.toHaveText(/download/)
  await bob.reload()
  await expect(bob.getByTestId('role-badge')).toContainText('View only')
  await openFileMenu(bob)
  await expect(bob.getByText('The owner hasn’t allowed downloading')).toBeVisible()
  await expect(bob.getByRole('menuitem', { name: 'Make a copy' })).toHaveAttribute('aria-disabled', 'true')
  await expect(bob.getByRole('menuitem', { name: 'Print' })).toHaveAttribute('aria-disabled', 'true')
  await bob.keyboard.press('Escape')
  expect((await bob.request.get(`/api/documents/${id}/export?format=markdown`)).status()).toBe(403)
  expect((await bob.request.get(`/api/documents/${id}/export?format=text`)).status()).toBe(403)
  expect((await bob.request.post(`/api/documents/${id}/copy`)).status()).toBe(403)
  // Printing is blocked for this user (print stylesheet hides the document)
  await bob.emulateMedia({ media: 'print' })
  await expect(bob.getByTestId('document-canvas')).toBeHidden()
  await bob.emulateMedia({ media: 'screen' })

  // Level 3 — Editor: edit + download
  await bobMenu.click()
  await alice.getByRole('menuitem', { name: /^Editor/ }).click()
  await expect(bobMenu).toHaveText(/Editor/)
  await bob.reload()
  await expect(bob.getByTestId('role-badge')).toContainText('Can edit')
  await expect(bob.getByRole('radiogroup', { name: 'Mode' })).toBeVisible()
  expect((await bob.request.get(`/api/documents/${id}/export?format=text`)).status()).toBe(200)

  const shares = await (await alice.request.get(`/api/documents/${id}/shares`)).json()
  expect(shares).toEqual([expect.objectContaining({ permission: 'editor', can_download: true, user: expect.objectContaining({ id: bobId }) })])
})

test('owner downloads Markdown and plain text; the Markdown re-imports with the same structure', async ({ page }) => {
  await login(page)
  const id = await createDoc(page, 'Export doc')
  await page.goto(`/documents/${id}`)

  const md = await downloadVia(page, /Markdown/)
  expect(md.name).toBe('Export doc.md')
  for (const part of ['# Quarterly plan', 'Ship **faster** with [links](https://example.com)', '- [x] Done item', '| Feature | Status |', '```python\nprint("hi")\n```']) {
    expect(md.text).toContain(part)
  }

  const txt = await downloadVia(page, /Plain text/)
  expect(txt.name).toBe('Export doc.txt')
  expect(txt.text).toContain('Quarterly plan\n\nShip faster with links')
  expect(txt.text).toContain('[x] Done item')
  expect(txt.text).not.toContain('**')

  // Round trip: import the exported Markdown
  await page.goto('/')
  await page.getByRole('button', { name: 'Import', exact: true }).click()
  await page.getByTestId('import-file-input').setInputFiles({ name: 'roundtrip.md', mimeType: 'text/markdown', buffer: Buffer.from(md.text) })
  await page.getByRole('dialog').getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page).toHaveURL(/\/documents\//)
  const imported = await (await page.request.get(`/api/documents/${page.url().split('/').pop()}`)).json()
  expect(imported.content.content.map((n: { type: string }) => n.type)).toEqual(RICH.content.map((n) => n.type))
})

test('Download as PDF and Print use the print pipeline with a document-only layout', async ({ page }) => {
  await login(page)
  await page.goto(`/documents/${await createDoc(page, 'Print doc')}`)
  await page.evaluate(() => {
    ;(window as unknown as { __printed: number }).__printed = 0
    window.print = () => void (window as unknown as { __printed: number }).__printed++
  })

  await openFileMenu(page)
  await page.getByRole('menuitem', { name: 'Download' }).hover()
  await page.getByRole('menuitem', { name: /PDF/ }).click()
  await expect(page.getByText('Choose “Save as PDF”')).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1)

  await openFileMenu(page)
  await page.getByRole('menuitem', { name: 'Print' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(2)

  // Print layout: only the document is shown
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('header').first()).toBeHidden()
  await expect(page.getByTestId('status-bar')).toBeHidden()
  await expect(page.getByTestId('document-canvas')).toBeVisible()
  await expect(editor(page).locator('h1')).toHaveText('Quarterly plan')
})

test('Make a copy creates a private copy owned by the current user and opens it', async ({ browser }) => {
  const alice = await userPage(browser, 'alice@example.com')
  const id = await createDoc(alice, 'Original doc')
  await alice.request.post(`/api/documents/${id}/shares`, { data: { email: 'bob@example.com', permission: 'viewer', can_download: true } })

  const bob = await userPage(browser, 'bob@example.com')
  await bob.goto(`/documents/${id}`)
  await openFileMenu(bob)
  await bob.getByRole('menuitem', { name: 'Make a copy' }).click()
  await expect(bob).not.toHaveURL(new RegExp(id))
  await expect(bob.getByLabel('Document title')).toHaveValue('Copy of Original doc') // Bob owns it: editable title
  await expect(editor(bob).locator('h1')).toHaveText('Quarterly plan')
  await expect(editor(bob).locator('table th')).toHaveText(['Feature', 'Status'])
  await expect(editor(bob)).toHaveAttribute('contenteditable', 'true')

  const copyId = bob.url().split('/').pop()!
  const copy = await (await bob.request.get(`/api/documents/${copyId}`)).json()
  expect(copy.owner.email).toBe('bob@example.com')
  expect(copy.content).toEqual(RICH)
  expect((await alice.request.get(`/api/documents/${copyId}`)).status()).toBe(404) // private to Bob
})

test('a copy includes edits that were still waiting for autosave', async ({ page }) => {
  await login(page)
  await page.goto(`/documents/${await createDoc(page, 'Fresh edits', { type: 'doc', content: [p('Start')] })}`)
  await editor(page).click()
  await page.keyboard.press('End')
  await page.keyboard.type(' plus unsaved words')
  await openFileMenu(page) // immediately, before the debounce fires
  await page.getByRole('menuitem', { name: 'Make a copy' }).click()
  await expect(page.getByLabel('Document title')).toHaveValue('Copy of Fresh edits')
  await expect(editor(page)).toHaveText('Start plus unsaved words')
})

test('dashboard card menu: owners get Rename/Share/Download/Delete; viewers only what they may do', async ({ browser }) => {
  const alice = await userPage(browser, 'alice@example.com')
  const id = await createDoc(alice, 'Menu doc')
  await alice.goto('/')
  await alice.getByRole('button', { name: 'Actions for Menu doc' }).first().click()
  for (const item of ['Rename', 'Share', 'Download', 'Delete']) {
    await expect(alice.getByRole('menuitem', { name: item, exact: true })).toBeVisible()
  }
  await alice.getByRole('menuitem', { name: 'Download', exact: true }).hover()
  const [download] = await Promise.all([alice.waitForEvent('download'), alice.getByRole('menuitem', { name: /Markdown/ }).click()])
  expect(download.suggestedFilename()).toBe('Menu doc.md')
  await alice.getByRole('button', { name: 'Actions for Menu doc' }).first().click()
  await alice.getByRole('menuitem', { name: 'Share', exact: true }).click()
  await expect(alice.getByRole('dialog')).toContainText('Share “Menu doc”')

  await alice.request.post(`/api/documents/${id}/shares`, { data: { email: 'bob@example.com', permission: 'viewer' } })
  const bob = await userPage(browser, 'bob@example.com')
  await bob.goto('/shared')
  await expect(bob.getByText('Menu doc')).toBeVisible()
  await expect(bob.getByRole('button', { name: 'Actions for Menu doc' })).toHaveCount(0) // no download, not owner
})
