import { markdownToDoc, textToDoc, type TiptapDoc } from './convert'

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024 // 2 MB
export const SUPPORTED_EXTENSIONS = ['.txt', '.md'] as const
/** For the <input accept> attribute. MIME types for .md vary by OS, so extensions are used. */
export const ACCEPT = SUPPORTED_EXTENSIONS.join(',')

export class ImportError extends Error {}

export interface ImportedDocument {
  title: string
  content: TiptapDoc
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot).toLowerCase() : ''
}

/** Cheap checks that need no file reading (used immediately on selection). */
export function validateFile(file: File): void {
  const ext = extensionOf(file.name)
  if (!(SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new ImportError(
      ext
        ? `“${ext}” files aren’t supported. Choose a .txt or .md file.`
        : 'This file has no extension. Choose a .txt or .md file.',
    )
  }
  if (file.size === 0) throw new ImportError('This file is empty.')
  if (file.size > MAX_IMPORT_BYTES) {
    throw new ImportError(`This file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_IMPORT_BYTES)}.`)
  }
}

export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/\s+/g, ' ').trim()
  return base.slice(0, 200) || 'Imported document'
}

/** Validate, decode and convert a .txt/.md file into a document ready for POST /documents. */
export async function readImportFile(file: File): Promise<ImportedDocument> {
  validateFile(file)

  let text: string
  try {
    // fatal: reject invalid UTF-8 instead of silently inserting U+FFFD characters.
    text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
  } catch {
    throw new ImportError('This file isn’t readable text. Quill can import UTF-8 encoded .txt and .md files.')
  }
  if (text.includes('\u0000')) throw new ImportError('This file contains binary data, not text.')
  if (!text.trim()) throw new ImportError('This file is empty.')

  let content: TiptapDoc
  try {
    content = extensionOf(file.name) === '.md' ? markdownToDoc(text) : textToDoc(text)
  } catch {
    throw new ImportError('Quill couldn’t convert this file. Try saving it as plain text.')
  }
  return { title: titleFromFileName(file.name), content }
}
