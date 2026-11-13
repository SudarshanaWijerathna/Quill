import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { FormError } from '@/components/FormError'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { DocumentSummary } from '@/lib/types'

/** Mount with a `key` per document so the form state resets for each one. */
export function RenameDialog({
  doc,
  onClose,
  onRename,
}: {
  doc: DocumentSummary | null
  onClose: () => void
  onRename: (doc: DocumentSummary, title: string) => Promise<void>
}) {
  const [title, setTitle] = useState(doc?.title ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!doc) return
    const trimmed = title.trim()
    if (!trimmed) return setError('Title cannot be empty.')
    if (trimmed === doc.title) return onClose()
    setSaving(true)
    setError(null)
    try {
      await onRename(doc, trimmed)
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!doc} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
            <DialogDescription>Choose a clear, descriptive title.</DialogDescription>
          </DialogHeader>
          <div className="my-5 space-y-3">
            <FormError message={error} />
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Document title"
              className="h-10"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteDialog({
  doc,
  onClose,
  onDelete,
}: {
  doc: DocumentSummary | null
  onClose: () => void
  onDelete: (doc: DocumentSummary) => Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    if (!doc) return
    setDeleting(true)
    setError(null)
    try {
      await onDelete(doc)
      onClose()
    } catch (err) {
      setError((err as Error).message)
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={!!doc} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{doc?.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the document. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FormError message={error} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          {/* Plain button (not AlertDialogAction) so the dialog stays open until the request finishes. */}
          <Button variant="destructive" onClick={confirm} disabled={deleting}>
            {deleting && <Loader2 className="animate-spin" />}
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
