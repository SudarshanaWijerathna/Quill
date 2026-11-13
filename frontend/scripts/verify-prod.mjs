// Smoke test for a deployed instance: node scripts/verify-prod.mjs https://<app>.fly.dev
// Creates/uses the demo accounts via the public API and checks auth, editing, import and sharing.
import { chromium, request } from '@playwright/test'

const BASE = process.argv[2]
const PASSWORD = 'quill-demo-123'
const results = []
const ok = (name, cond, detail = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  â€” ' + detail : ''}`)
  if (!cond) process.exitCode = 1
}

// 1. API basics + demo accounts (created through the normal public registration endpoint)
const api = await request.newContext({ baseURL: BASE })
const health = await api.get('/api/health')
ok('GET /api/health', health.status() === 200, JSON.stringify(await health.json()))
for (const [email, name] of [['alice@example.com', 'Alice Carter'], ['bob@example.com', 'Bob Nguyen']]) {
  const r = await api.post('/api/auth/register', { data: { email, name, password: PASSWORD } })
  ok(`demo account ${email}`, r.status() === 201 || r.status() === 409, r.status() === 409 ? 'already existed' : 'created')
}
const login = await api.post('/api/auth/login', { data: { email: 'alice@example.com', password: PASSWORD } })
const cookie = login.headers()['set-cookie'] ?? ''
ok('login sets session cookie', login.status() === 200 && /quill_session=/.test(cookie))
ok('cookie is HttpOnly; Secure; SameSite=lax', /httponly/i.test(cookie) && /secure/i.test(cookie) && /samesite=lax/i.test(cookie), cookie.replace(/quill_session=[^;]+/, 'quill_session=<redacted>'))
const anon = await (await request.newContext({ baseURL: BASE })).get('/api/documents')
ok('unauthenticated /api/documents is 401', anon.status() === 401)
ok('SPA deep link serves index.html', (await api.get('/documents/some-id')).headers()['content-type']?.includes('text/html'))
ok('favicon /quill.svg', (await api.get('/quill.svg')).status() === 200)

// 2. Browser flow
const browser = await chromium.launch({ channel: 'msedge' })
const errors = []
const page = await (await browser.newContext()).newPage()
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(BASE + '/login')
await page.fill('#email', 'alice@example.com'); await page.fill('#password', PASSWORD); await page.click('button[type=submit]')
await page.getByRole('heading', { level: 1 }).filter({ hasText: 'Alice' }).waitFor({ timeout: 20000 })
ok('UI login â†’ dashboard', true)

await page.getByRole('button', { name: 'New document' }).click()
await page.locator('.ProseMirror').waitFor({ timeout: 20000 })
const docId = page.url().split('/').pop()
await page.getByLabel('Document title').fill('Production check')
await page.getByLabel('Document title').press('Enter')
await page.keyboard.press('ControlOrMeta+b'); await page.keyboard.type('Bold text'); await page.keyboard.press('ControlOrMeta+b')
await page.keyboard.type(' typed on the live site')
await page.getByTestId('save-status').and(page.locator('[data-status="saved"]')).waitFor({ timeout: 15000 })
await page.reload()
await page.locator('.ProseMirror strong').waitFor({ timeout: 20000 })
const text = await page.locator('.ProseMirror').innerText()
ok('edit + autosave + refresh persists formatting', text.includes('Bold text typed on the live site') && (await page.locator('.ProseMirror strong').innerText()) === 'Bold text')
ok('title persisted', (await page.getByLabel('Document title').inputValue()) === 'Production check')

// Import
await page.goto(BASE + '/')
await page.getByRole('button', { name: 'Import', exact: true }).click()
await page.getByTestId('import-file-input').setInputFiles({ name: 'prod-import.md', mimeType: 'text/markdown', buffer: Buffer.from('# Imported\n\n- [x] task\n\n| A | B |\n| - | - |\n| 1 | 2 |\n') })
await page.getByRole('dialog').getByRole('button', { name: 'Import', exact: true }).click()
await page.locator('.ProseMirror h1').waitFor({ timeout: 20000 })
ok('Markdown import (heading, task list, table)', (await page.locator('.ProseMirror h1').innerText()) === 'Imported' && (await page.locator('.ProseMirror table').count()) === 1 && (await page.locator('.ProseMirror input[type=checkbox]').count()) === 1)

// Sharing: viewer without download
const share = await page.request.post(BASE + `/api/documents/${docId}/shares`, { data: { email: 'bob@example.com', permission: 'viewer', can_download: false } })
ok('share with Bob (viewer)', share.status() === 201 || share.status() === 409, String(share.status()))
const bob = await (await browser.newContext()).newPage()
await bob.goto(BASE + '/login')
await bob.fill('#email', 'bob@example.com'); await bob.fill('#password', PASSWORD); await bob.click('button[type=submit]')
await bob.getByRole('heading', { level: 1 }).filter({ hasText: 'Bob' }).waitFor({ timeout: 20000 })
await bob.goto(BASE + '/shared')
await bob.getByText('Production check').first().waitFor({ timeout: 20000 })
ok('Bob sees it in Shared with me', true)
await bob.goto(BASE + `/documents/${docId}`)
await bob.locator('.ProseMirror').waitFor({ timeout: 20000 })
ok('Bob: read-only editor', (await bob.locator('.ProseMirror').getAttribute('contenteditable')) === 'false')
ok('Bob: PATCH forbidden', (await bob.request.patch(BASE + `/api/documents/${docId}`, { data: { content: { type: 'doc', content: [] } } })).status() === 403)
ok('Bob: export forbidden (no download)', (await bob.request.get(BASE + `/api/documents/${docId}/export?format=markdown`)).status() === 403)
ok('owner export works', (await page.request.get(BASE + `/api/documents/${docId}/export?format=markdown`)).status() === 200)
ok('no page errors', errors.length === 0, errors.join(' | '))

await browser.close()
console.log(results.join('\n'))
