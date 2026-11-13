import { expect, test, type Browser, type Page } from '@playwright/test'

const PASSWORD = 'quill-demo-123'
const ALICE = 'alice@example.com'
const BOB = 'bob@example.com'

async function loginAs(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext() // separate cookies per user
  const page = await context.newPage()
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', PASSWORD)
  await page.click('button[type=submit]')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Good')
  return page
}

const editor = (page: Page) => page.locator('.ProseMirror')

test('owner shares, viewer is read-only, editor can edit, revoked user loses access', async ({ browser }) => {
  const alice = await loginAs(browser, ALICE)
  const bob = await loginAs(browser, BOB)

  // Alice creates a document with content
  const created = await alice.request.post('/api/documents', {
    data: {
      title: 'Team charter',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original text' }] }] },
    },
  })
  const docId = (await created.json()).id

  // --- 1. Owner shares with Bob as a viewer via the dialog ---------------------------------------
  await alice.goto(`/documents/${docId}`)
  await alice.getByRole('button', { name: 'Share' }).click()
  const dialog = alice.getByRole('dialog')
  await expect(dialog.getByText('People with access')).toBeVisible()
  await dialog.getByLabel('Email address').fill(BOB)
  await dialog.getByRole('button', { name: 'Share', exact: true }).click()
  const bobRow = dialog.getByTestId('collaborator').filter({ hasText: 'Bob Nguyen' })
  await expect(bobRow).toBeVisible()
  await expect(bobRow.getByRole('button', { name: 'Permission for Bob Nguyen' })).toHaveText(/Viewer/)

  // Duplicate invite is rejected with a clear message
  await dialog.getByLabel('Email address').fill(BOB)
  await dialog.getByRole('button', { name: 'Share', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('already has access')

  // --- 2. Bob sees it in "Shared with me" ---------------------------------------------------------
  await bob.getByRole('link', { name: 'Shared with me' }).click()
  const sharedRow = bob.getByRole('list', { name: 'Shared documents' }).getByRole('listitem').filter({ hasText: 'Team charter' })
  await expect(sharedRow).toBeVisible()
  await expect(sharedRow).toContainText('View only')
  await expect(sharedRow).toContainText('Alice Carter')
  // Not in Bob's own documents
  await bob.getByRole('link', { name: 'My documents' }).click()
  await expect(bob.getByRole('link', { name: 'Team charter' })).toHaveCount(0)

  // --- 3 & 4. Viewer can read but not edit --------------------------------------------------------
  let bobPatches = 0
  bob.on('request', (r) => r.method() === 'PATCH' && bobPatches++)
  await bob.goto(`/documents/${docId}`)
  await expect(editor(bob)).toContainText('Original text')
  await expect(editor(bob)).toHaveAttribute('contenteditable', 'false')
  await expect(bob.getByRole('toolbar', { name: 'Formatting' })).toHaveAttribute('aria-disabled', 'true')
  await expect(bob.getByRole('button', { name: 'Bold', exact: true })).toBeDisabled()
  await expect(bob.getByRole('button', { name: 'Share' })).toHaveCount(0)
  await expect(bob.getByLabel('Document title')).toHaveCount(0) // title is not an input
  await expect(bob.getByTestId('document-title')).toHaveText('Team charter')
  await expect(bob.getByTestId('role-badge')).toContainText('View only')
  await expect(bob.getByRole('note')).toContainText('view-only access')
  await editor(bob).click()
  await bob.keyboard.type('Viewer typing')
  await bob.waitForTimeout(1200)
  await expect(editor(bob)).not.toContainText('Viewer typing')
  expect(bobPatches).toBe(0)

  // --- 8. Owner upgrades Bob to editor ------------------------------------------------------------
  await bobRow.getByRole('button', { name: 'Permission for Bob Nguyen' }).click()
  await alice.getByRole('menuitem', { name: /Editor/ }).click()
  await expect(bobRow.getByRole('button', { name: 'Permission for Bob Nguyen' })).toHaveText(/Editor/)

  // --- 5 & 6. Editor can edit content (autosave) but has no owner controls ----------------------
  await bob.reload()
  await expect(bob.getByTestId('role-badge')).toContainText('Can edit')
  await expect(bob.getByRole('toolbar', { name: 'Formatting' })).toBeVisible()
  await expect(bob.getByRole('button', { name: 'Share' })).toHaveCount(0)
  await expect(bob.getByLabel('Document title')).toHaveCount(0)
  await editor(bob).click()
  await bob.keyboard.press('End')
  await bob.keyboard.type(' plus edits by Bob')
  await expect(bob.getByTestId('save-status')).toHaveAttribute('data-status', 'saved', { timeout: 10_000 })
  await expect
    .poll(async () => JSON.stringify((await (await alice.request.get(`/api/documents/${docId}`)).json()).content))
    .toContain('plus edits by Bob')

  // --- 9 & 10. Owner revokes access; Bob loses it immediately, even mid-session ------------------
  await bobRow.getByRole('button', { name: 'Permission for Bob Nguyen' }).click()
  await alice.getByRole('menuitem', { name: 'Remove access' }).click()
  await expect(dialog.getByTestId('collaborator')).toHaveCount(0)

  // Bob still has the editor open; his next save is rejected and the UI locks
  await editor(bob).click()
  await bob.keyboard.type(' after revoke')
  await expect(bob.getByRole('note')).toContainText('edit access to this document was removed', { timeout: 10_000 })
  await expect(editor(bob)).toHaveAttribute('contenteditable', 'false')
  const afterRevoke = await (await alice.request.get(`/api/documents/${docId}`)).json()
  expect(JSON.stringify(afterRevoke.content)).not.toContain('after revoke')

  await bob.reload()
  await expect(bob.getByText('Document not found')).toBeVisible()
  await bob.goto('/shared')
  // Other tests share their own documents with Bob (same seeded DB), so assert on this document.
  await expect(bob.getByRole('heading', { name: 'Shared with me' })).toBeVisible()
  await expect(bob.getByText('Team charter')).toHaveCount(0)
  const shared = await (await bob.request.get('/api/documents/shared-with-me')).json()
  expect(shared.map((d: { id: string }) => d.id)).not.toContain(docId)
})

test('a user with no share cannot open another user’s document', async ({ browser }) => {
  const alice = await loginAs(browser, ALICE)
  const bob = await loginAs(browser, BOB)
  const created = await alice.request.post('/api/documents', { data: { title: 'Private notes' } })
  const docId = (await created.json()).id

  await bob.goto(`/documents/${docId}`)
  await expect(bob.getByText('Document not found')).toBeVisible()
  expect((await bob.request.get(`/api/documents/${docId}`)).status()).toBe(404)
  expect((await bob.request.patch(`/api/documents/${docId}`, { data: { title: 'x' } })).status()).toBe(404)
})
