import { expect, test, type Page } from '@playwright/test'

const ALICE = { email: 'alice@example.com', password: 'quill-demo-123' }

async function login(page: Page) {
  await page.goto('/login')
  await page.fill('#email', ALICE.email)
  await page.fill('#password', ALICE.password)
  await page.click('button[type=submit]')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Alice')
}

/** Create a document through the API (shares the browser's session cookie). */
async function createDoc(page: Page, title: string): Promise<string> {
  const res = await page.request.post('/api/documents', { data: { title } })
  expect(res.status()).toBe(201)
  return (await res.json()).id
}

async function getDoc(page: Page, id: string) {
  const res = await page.request.get(`/api/documents/${id}`)
  expect(res.ok()).toBeTruthy()
  return res.json()
}

const editor = (page: Page) => page.locator('.ProseMirror')
const saveStatus = (page: Page) => page.getByTestId('save-status')
const expectSaved = (page: Page) => expect(saveStatus(page)).toHaveAttribute('data-status', 'saved', { timeout: 10_000 })

test.describe('session', () => {
  test('logged-out load produces no 401 console errors and the session survives a refresh', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    const statuses: number[] = []
    page.on('response', (r) => r.url().includes('/api/auth/') && statuses.push(r.status()))

    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    expect(errors).toEqual([])
    expect(statuses).not.toContain(401)

    await login(page)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Alice')
    await expect(page).not.toHaveURL(/login/)
    expect(errors).toEqual([])
  })
})

test.describe('editor', () => {
  test.beforeEach(async ({ page }) => login(page))

  test('opens an existing document with its stored content', async ({ page }) => {
    await page.getByRole('link', { name: 'Q4 Product Roadmap' }).first().click()
    await expect(page.getByLabel('Document title')).toHaveValue('Q4 Product Roadmap')
    await expect(editor(page).locator('h1')).toHaveText('Q4 Product Roadmap')
    await expect(editor(page).locator('ul li')).toHaveCount(3)
    await expectSaved(page)
  })

  test('formatting is saved as Tiptap JSON and preserved after refresh', async ({ page }) => {
    const id = await createDoc(page, 'Formatting test')
    await page.goto(`/documents/${id}`)
    await editor(page).click()

    // Heading via the style selector
    await page.getByRole('button', { name: 'Text style' }).click()
    await page.getByRole('menuitem', { name: /Heading 1/ }).click()
    await page.keyboard.type('Project plan')
    await page.keyboard.press('Enter')

    // Bold via keyboard shortcut, italic and underline via toolbar
    await page.keyboard.press('ControlOrMeta+b')
    await page.keyboard.type('Bold')
    await page.keyboard.press('ControlOrMeta+b')
    await page.keyboard.type(' ')
    await page.getByRole('button', { name: 'Italic' }).click()
    await page.keyboard.type('italic')
    await page.getByRole('button', { name: 'Italic' }).click()
    await page.keyboard.type(' ')
    await page.getByRole('button', { name: 'Underline' }).click()
    await page.keyboard.type('underlined')
    await page.getByRole('button', { name: 'Underline' }).click()
    await page.keyboard.press('Enter')

    // Lists
    await page.getByRole('button', { name: 'Bulleted list' }).click()
    await page.keyboard.type('First bullet')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Second bullet')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter') // leave the list
    await page.getByRole('button', { name: 'Heading 2' }).click()
    await page.keyboard.type('Steps')
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Numbered list' }).click()
    await page.keyboard.type('Step one')

    // Toolbar reflects the active formatting at the cursor
    await expect(page.getByRole('button', { name: 'Numbered list' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Bulleted list' })).toHaveAttribute('aria-pressed', 'false')

    await expectSaved(page)
    await page.reload()

    const ed = editor(page)
    await expect(ed.locator('h1')).toHaveText('Project plan')
    await expect(ed.locator('strong')).toHaveText('Bold')
    await expect(ed.locator('em')).toHaveText('italic')
    await expect(ed.locator('u')).toHaveText('underlined')
    await expect(ed.locator('ul li')).toHaveText(['First bullet', 'Second bullet'])
    await expect(ed.locator('h2')).toHaveText('Steps')
    await expect(ed.locator('ol li')).toHaveText(['Step one'])

    // Cursor inside bold text -> Bold button is active
    await ed.locator('strong').click()
    await expect(page.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true')

    // Stored as structured JSON, not HTML
    const doc = await getDoc(page, id)
    const types = JSON.stringify(doc.content)
    expect(doc.content.type).toBe('doc')
    for (const t of ['"heading"', '"bold"', '"italic"', '"underline"', '"bulletList"', '"orderedList"']) {
      expect(types).toContain(t)
    }
  })

  test('autosave is debounced (no request per keystroke)', async ({ page }) => {
    const id = await createDoc(page, 'Debounce test')
    await page.goto(`/documents/${id}`)
    let patches = 0
    page.on('request', (r) => r.method() === 'PATCH' && r.url().includes(id) && patches++)

    await editor(page).click()
    await page.keyboard.type('The quick brown fox jumps over the lazy dog', { delay: 20 })
    await expectSaved(page)
    expect(patches).toBeGreaterThanOrEqual(1)
    expect(patches).toBeLessThanOrEqual(2)

    // Nothing changed -> no further requests
    await page.waitForTimeout(1500)
    expect(patches).toBeLessThanOrEqual(2)
  })

  test('opening and clicking around a document without editing sends no save', async ({ page }) => {
    let patches = 0
    page.on('request', (r) => r.method() === 'PATCH' && patches++)
    await page.getByRole('link', { name: 'Q4 Product Roadmap' }).first().click()
    await expect(editor(page).locator('h1')).toBeVisible()
    await editor(page).locator('ul li').last().click()
    await editor(page).locator('h1').click()
    await page.keyboard.press('ArrowDown')
    await page.waitForTimeout(1500) // longer than the autosave debounce
    expect(patches).toBe(0)
    await expect(saveStatus(page)).toHaveAttribute('data-status', 'saved')
  })

  test('renaming from the header persists', async ({ page }) => {
    const id = await createDoc(page, 'Old title')
    await page.goto(`/documents/${id}`)
    const title = page.getByLabel('Document title')
    await title.fill('Renamed in editor')
    await title.press('Enter')
    await expectSaved(page)
    await expect.poll(async () => (await getDoc(page, id)).title).toBe('Renamed in editor')

    await page.reload()
    await expect(page.getByLabel('Document title')).toHaveValue('Renamed in editor')
    await page.getByRole('link', { name: 'Back to documents' }).click()
    await expect(page.getByRole('link', { name: 'Renamed in editor' }).first()).toBeVisible()
  })

  test('navigating away before the debounce fires still saves, without leaking into other documents', async ({ page }) => {
    const a = await createDoc(page, 'Doc A')
    const b = await createDoc(page, 'Doc B')

    await page.goto(`/documents/${a}`)
    await editor(page).click()
    await page.keyboard.type('Alpha content')
    // Leave immediately (well under the 800 ms debounce)
    await page.getByRole('link', { name: 'Back to documents' }).click()
    await page.getByRole('link', { name: 'Doc B' }).first().click()
    await expect(page.getByLabel('Document title')).toHaveValue('Doc B')
    await editor(page).click()
    await page.keyboard.type('Bravo content')
    await expectSaved(page)

    await expect.poll(async () => JSON.stringify((await getDoc(page, a)).content)).toContain('Alpha content')
    const docA = JSON.stringify((await getDoc(page, a)).content)
    const docB = JSON.stringify((await getDoc(page, b)).content)
    expect(docA).not.toContain('Bravo')
    expect(docB).toContain('Bravo content')
    expect(docB).not.toContain('Alpha')

    await page.goto(`/documents/${a}`)
    await expect(editor(page)).toContainText('Alpha content')
  })

  test('failed saves show an error, keep the content, and recover on retry', async ({ page }) => {
    const id = await createDoc(page, 'Failure test')
    await page.goto(`/documents/${id}`)

    // Simulate the backend failing every PATCH
    await page.route(`**/api/documents/${id}`, (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"detail":"Internal server error"}' })
        : route.continue(),
    )
    await editor(page).click()
    await page.keyboard.type('Unsaved words')
    await expect(saveStatus(page)).toHaveAttribute('data-status', 'error', { timeout: 10_000 })
    await expect(saveStatus(page)).toContainText('Couldn’t save')
    await expect(editor(page)).toContainText('Unsaved words') // content is not lost locally

    // Backend recovers; manual retry succeeds
    await page.unroute(`**/api/documents/${id}`)
    await saveStatus(page).getByRole('button', { name: 'Retry' }).click()
    await expectSaved(page)

    await page.reload()
    await expect(editor(page)).toContainText('Unsaved words')
  })

  test('shows a not-found state for an inaccessible document', async ({ page }) => {
    await page.goto('/documents/00000000-0000-0000-0000-000000000000')
    await expect(page.getByText('Document not found')).toBeVisible()
  })
})
