import { exportDocument, type ExportFormat } from '@/lib/api'

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Permission-checked server export (403 without download permission), saved as a file. */
export async function downloadDocument(id: string, format: ExportFormat) {
  const { blob, filename } = await exportDocument(id, format)
  saveBlob(blob, filename)
}
