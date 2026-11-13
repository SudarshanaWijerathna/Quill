/**
 * Thin fetch wrapper for the Quill API.
 * - Dev: VITE_API_URL is empty, so requests go to `/api/...` and Vite proxies them to FastAPI.
 * - Prod: set VITE_API_URL to the deployed backend origin (e.g. https://quill-api.example.com).
 *
 * Auth uses an httpOnly session cookie set by the backend, so no token is ever stored or read
 * by JavaScript. `credentials: 'include'` makes the browser send it.
 */
import {
  levelToShare,
  type AccessLevel,
  type DocumentContent,
  type DocumentDetail,
  type DocumentSummary,
  type Share,
  type User,
} from '@/lib/types'

const API_BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let onUnauthorized: (() => void) | null = null

/** Registered by the auth provider so an expired session anywhere logs the user out. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

function errorMessage(data: unknown, fallback: string): string {
  const detail = (data as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  // FastAPI validation errors: [{ loc, msg, ... }]
  if (Array.isArray(detail) && detail.length > 0) {
    const msg = String(detail[0]?.msg ?? fallback)
    return msg.replace(/^Value error, /, '')
  }
  return fallback
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' })
  } catch {
    throw new ApiError(0, 'Unable to reach the server. Check your connection and try again.')
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized?.()
    throw new ApiError(res.status, errorMessage(data, res.statusText || 'Request failed'))
  }

  return (res.status === 204 ? undefined : await res.json()) as T
}

const json = (body: unknown) => JSON.stringify(body)

export const authApi = {
  /** 200 with `user: null` when signed out, so restoring a session never logs a 401. */
  session: () => api<{ user: User | null }>('/auth/session'),
  login: (email: string, password: string) =>
    api<{ user: User }>('/auth/login', { method: 'POST', body: json({ email, password }) }),
  register: (name: string, email: string, password: string) =>
    api<{ user: User }>('/auth/register', { method: 'POST', body: json({ name, email, password }) }),
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
}

export const documentsApi = {
  list: () => api<DocumentSummary[]>('/documents'),
  get: (id: string) => api<DocumentDetail>(`/documents/${id}`),
  create: (title?: string, content?: DocumentContent) =>
    api<DocumentDetail>('/documents', {
      method: 'POST',
      body: json({ ...(title ? { title } : {}), ...(content ? { content } : {}) }),
    }),
  update: (
    id: string,
    patch: Partial<Pick<DocumentDetail, 'title' | 'content'>>,
    { keepalive = false }: { keepalive?: boolean } = {},
  ) => {
    const body = json(patch)
    // Browsers cap keepalive bodies at 64 KB; larger saves fall back to a normal request.
    return api<DocumentDetail>(`/documents/${id}`, {
      method: 'PATCH',
      body,
      keepalive: keepalive && body.length < 60_000,
    })
  },
  remove: (id: string) => api<void>(`/documents/${id}`, { method: 'DELETE' }),
  sharedWithMe: () => api<DocumentSummary[]>('/documents/shared-with-me'),
  copy: (id: string) => api<DocumentDetail>(`/documents/${id}/copy`, { method: 'POST' }),
}

export const sharesApi = {
  list: (docId: string) => api<Share[]>(`/documents/${docId}/shares`),
  create: (docId: string, email: string, level: AccessLevel) =>
    api<Share>(`/documents/${docId}/shares`, { method: 'POST', body: json({ email, ...levelToShare(level) }) }),
  update: (docId: string, userId: number, level: AccessLevel) =>
    api<Share>(`/documents/${docId}/shares/${userId}`, { method: 'PATCH', body: json(levelToShare(level)) }),
  remove: (docId: string, userId: number) =>
    api<void>(`/documents/${docId}/shares/${userId}`, { method: 'DELETE' }),
}

export type ExportFormat = 'markdown' | 'text'

/** Filename from Content-Disposition (prefers the RFC 5987 UTF-8 form). */
function filenameFrom(header: string | null, fallback: string): string {
  if (!header) return fallback
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]!)
    } catch {
      /* fall through */
    }
  }
  return header.match(/filename="([^"]+)"/i)?.[1] ?? fallback
}

/** Server-side export (permission-checked). Returns the file for the browser to save. */
export async function exportDocument(id: string, format: ExportFormat): Promise<{ blob: Blob; filename: string }> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/documents/${id}/export?format=${format}`, { credentials: 'include' })
  } catch {
    throw new ApiError(0, 'Unable to reach the server. Check your connection and try again.')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    if (res.status === 401) onUnauthorized?.()
    throw new ApiError(res.status, errorMessage(data, res.statusText || 'Download failed'))
  }
  const fallback = `document.${format === 'markdown' ? 'md' : 'txt'}`
  return { blob: await res.blob(), filename: filenameFrom(res.headers.get('Content-Disposition'), fallback) }
}
