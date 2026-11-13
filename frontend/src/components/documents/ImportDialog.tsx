import { useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Loader2, Upload, X } from 'lucide-react'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { documentsApi } from '@/lib/api'
import {
  ACCEPT,
  formatBytes,
  ImportError,
  MAX_IMPORT_BYTES,
  readImportFile,
  validateFile,
} from '@/lib/import/importFile'
import { cn } from '@/lib/utils'

/**
 * Import a .txt/.md file as a new document: pick or drop a file, validate it, convert it to
 * Tiptap JSON in the browser, create it through POST /documents, then open it.
 */
export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const importingRef = useRef(false) // synchronous guard against double clicks / double submits
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragging, setDragging] = useState(false)

  const reset = () => {
    setFile(null)
    setError(null)
    setDragging(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const choose = (selected: File | undefined | null) => {
    if (!selected || importingRef.current) return
    setFile(selected)
    try {
      validateFile(selected)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length > 1) {
      setFile(null)
      setError('Drop one file at a time.')
      return
    }
    choose(e.dataTransfer.files[0])
  }

  const runImport = async () => {
    if (!file || error || importingRef.current) return
    importingRef.current = true
    setImporting(true)
    try {
      const { title, content } = await readImportFile(file)
      const doc = await documentsApi.create(title, content)
      onOpenChange(false)
      navigate(`/documents/${doc.id}`)
    } catch (err) {
      setError(err instanceof ImportError ? err.message : `Import failed: ${(err as Error).message}`)
      importingRef.current = false
      setImporting(false)
    }
  }

  const close = (next: boolean) => {
    if (importingRef.current) return // don't close mid-import
    if (!next) reset()
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import a document</DialogTitle>
          <DialogDescription>Create a new document from a text or Markdown file.</DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="import-file-input"
          onChange={(e) => choose(e.target.files?.[0])}
        />

        <div
          role="button"
          tabIndex={0}
          aria-label="Choose a file to import, or drop one here"
          data-testid="import-dropzone"
          onClick={() => !importing && inputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), inputRef.current?.click())}
          onDragOver={(e) => {
            e.preventDefault()
            if (!importing) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            dragging ? 'border-primary bg-accent' : 'bg-muted/40 hover:bg-muted/70',
            importing && 'pointer-events-none opacity-60',
          )}
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-background shadow-sm ring-1 ring-border">
            <Upload className="size-4 text-primary" />
          </span>
          <p className="mt-3 text-sm font-medium">
            {dragging ? 'Drop to select' : (
              <>
                Drop a file here or <span className="text-primary underline-offset-2 hover:underline">browse</span>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            .txt or .md · up to {formatBytes(MAX_IMPORT_BYTES)} · UTF-8
          </p>
        </div>

        {file && (
          <div className="flex items-center gap-3 rounded-lg px-1" data-testid="import-selected-file">
            <FileText className={cn('size-4 shrink-0', error ? 'text-destructive' : 'text-primary')} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            {!importing && (
              <Button variant="ghost" size="icon" className="size-8" onClick={reset} aria-label="Remove selected file">
                <X />
              </Button>
            )}
          </div>
        )}

        <FormError message={error} />

        <p className="text-xs text-muted-foreground">
          Markdown headings (H1–H3), bold, italic and lists are kept. Other formatting is imported as plain text;
          HTML is never rendered.
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={runImport} disabled={!file || !!error || importing}>
            {importing && <Loader2 className="animate-spin" />}
            {importing ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
