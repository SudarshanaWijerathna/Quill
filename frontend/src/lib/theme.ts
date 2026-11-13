import { useCallback, useSyncExternalStore } from 'react'

/**
 * Light/dark theme. The choice is a per-viewer preference, so localStorage is the right place
 * for it. index.html applies it before first paint; this module keeps it in sync afterwards.
 * Without a saved choice, the OS setting (prefers-color-scheme) is used.
 */
export type Theme = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'quill-theme'

const listeners = new Set<() => void>()

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null // storage blocked (private mode, sandbox): fall back to the OS setting
  }
}

function systemTheme(): Theme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
  listeners.forEach((l) => l())
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* not persisted, but still applied for this page */
  }
  apply(theme)
}

let initialized = false
/** Call once at startup: syncs state and follows OS changes while the user hasn't chosen. */
export function initTheme() {
  if (initialized) return
  initialized = true
  apply(readStored() ?? systemTheme())
  matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (!readStored()) apply(systemTheme())
  })
  // Print / "Save as PDF" always uses the light palette.
  let printedFrom: Theme | null = null
  window.addEventListener('beforeprint', () => {
    printedFrom = currentTheme()
    if (printedFrom === 'dark') document.documentElement.classList.remove('dark')
  })
  window.addEventListener('afterprint', () => {
    if (printedFrom === 'dark') document.documentElement.classList.add('dark')
    printedFrom = null
  })
}

export function useTheme(): [Theme, (t: Theme) => void, () => void] {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    currentTheme,
    () => 'light' as Theme,
  )
  const toggle = useCallback(() => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'), [])
  return [theme, setTheme, toggle]
}
