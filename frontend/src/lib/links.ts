/**
 * Link URL safety. Used by the editor's Link extension (which also refuses to render disallowed
 * hrefs), the link dialog and the Markdown importer. The backend validates hrefs independently.
 */
export const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:'] as const

/** True only for absolute http(s) URLs with a host, or mailto: addresses. */
export function isSafeUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return false
  }
  if (!(ALLOWED_PROTOCOLS as readonly string[]).includes(url.protocol)) return false
  if (url.protocol === 'mailto:') return /^[^@\s]+@[^@\s]+$/.test(decodeURIComponent(url.pathname))
  return url.hostname.length > 0
}

/**
 * Turn user input into a safe absolute URL, or null if it can't be one.
 * "example.com/x" → "https://example.com/x", "me@example.com" → "mailto:me@example.com".
 */
export function normalizeUrl(input: string): string | null {
  const value = input.trim()
  if (!value || /\s/.test(value)) return null
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value)
  let candidate = value
  if (!hasScheme) {
    if (/^[^@/]+@[^@/]+\.[^@/]+$/.test(value)) candidate = `mailto:${value}`
    else if (/^(localhost|[^/\s]+\.[a-z]{2,})(:\d+)?([/?#].*)?$/i.test(value)) candidate = `https://${value}`
    else return null
  }
  return isSafeUrl(candidate) ? candidate : null
}
