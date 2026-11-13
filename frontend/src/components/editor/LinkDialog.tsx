import { useState, type FormEvent } from 'react'
import type { Editor } from '@tiptap/react'
import { ExternalLink, Unlink } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { normalizeUrl } from '@/lib/links'
import type { LinkDialogState } from './link-state'

/** Mount with a `key` per opening so the form resets. */
export function LinkDialog({
  editor,
  state,
  onClose,
}: {
  editor: Editor
  state: LinkDialogState | null
  onClose: () => void
}) {
  const [url, setUrl] = useState(state?.href ?? '')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const save = (e: FormEvent) => {
    e.preventDefault()
    const href = normalizeUrl(url)
    if (!href) {
      setError('Enter a valid web address (https://…) or email address. Other link types aren’t allowed.')
      return
    }
    const chain = editor.chain().focus()
    if (state?.needsText) {
      const label = text.trim() || href
      chain.insertContent({ type: 'text', text: label, marks: [{ type: 'link', attrs: { href } }] }).run()
    } else {
      chain.extendMarkRange('link').setLink({ href }).run()
    }
    onClose()
  }

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    onClose()
  }

  const preview = normalizeUrl(url)

  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" onCloseAutoFocus={(e) => e.preventDefault()}>
        <form onSubmit={save} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{state?.isEditing ? 'Edit link' : 'Insert link'}</DialogTitle>
            <DialogDescription>Links can point to web pages (http, https) or email addresses.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="link-url">Address</Label>
            <Input
              id="link-url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setError(null)
              }}
              placeholder="https://example.com"
              autoFocus
              autoComplete="off"
              className="h-10"
            />
          </div>
          {state?.needsText && (
            <div className="space-y-2">
              <Label htmlFor="link-text">Text to display</Label>
              <Input
                id="link-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Defaults to the address"
                className="h-10"
              />
            </div>
          )}
          <FormError message={error} />
          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-2">
              {state?.isEditing && (
                <Button type="button" variant="ghost" onClick={remove} className="text-destructive hover:text-destructive">
                  <Unlink />
                  Remove link
                </Button>
              )}
              {preview && (
                <Button type="button" variant="ghost" asChild>
                  <a href={preview} target="_blank" rel="noopener noreferrer" aria-label="Open link in new tab">
                    <ExternalLink />
                  </a>
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!url.trim()}>
                {state?.isEditing ? 'Update' : 'Insert'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
