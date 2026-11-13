import { describe, expect, it } from 'vitest'
import { isSafeUrl, normalizeUrl } from './links'

describe('isSafeUrl', () => {
  it('allows http, https and mailto', () => {
    for (const url of ['https://example.com', 'http://localhost:5173/x?y#z', 'mailto:a@example.com']) {
      expect(isSafeUrl(url), url).toBe(true)
    }
  })

  it('rejects dangerous or non-web schemes and malformed URLs', () => {
    for (const url of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      ' javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'ftp://example.com',
      '//example.com',
      '/relative/path',
      'mailto:',
      'mailto:not-an-email',
      'https://',
      '',
    ]) {
      expect(isSafeUrl(url), url).toBe(false)
    }
  })
})

describe('normalizeUrl', () => {
  it('adds https:// to bare domains and mailto: to email addresses', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com')
    expect(normalizeUrl('  docs.example.com/a?b=1 ')).toBe('https://docs.example.com/a?b=1')
    expect(normalizeUrl('me@example.com')).toBe('mailto:me@example.com')
    expect(normalizeUrl('https://example.com/x')).toBe('https://example.com/x')
  })

  it('returns null for unsafe or unusable input', () => {
    for (const input of ['javascript:alert(1)', 'data:text/html,hi', 'not a url', 'hello', '', 'ftp://x.com']) {
      expect(normalizeUrl(input), input).toBeNull()
    }
  })
})
