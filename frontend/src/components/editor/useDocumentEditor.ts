import { useEditor } from '@tiptap/react'
import type { DocumentContent } from '@/lib/types'
import { createExtensions } from './extensions'

/**
 * Tiptap editor configured for Quill documents (schema defined in ./extensions.ts).
 * TrailingNode is disabled there so that viewing a document never modifies it.
 */
export function useDocumentEditor({
  content,
  editable = true,
  onChange,
  onContentError,
}: {
  content: DocumentContent
  editable?: boolean
  onChange: (json: DocumentContent) => void
  onContentError: (error: Error) => void
}) {
  return useEditor({
    editable,
    extensions: createExtensions(),
    content,
    // Reject content that does not match the schema instead of silently dropping parts of it.
    enableContentCheck: true,
    onContentError: ({ editor, error }) => {
      editor.setEditable(false)
      onContentError(error)
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON() as DocumentContent),
    editorProps: {
      attributes: {
        class: 'quill-prose',
        'aria-label': 'Document content',
        'aria-multiline': 'true',
        role: 'textbox',
        spellcheck: 'true',
      },
      // Links don't navigate on plain click while editing; Ctrl/Cmd+click opens them in a new tab.
      handleClick: (view, _pos, event) => {
        if (!view.editable || !(event.ctrlKey || event.metaKey)) return false
        const anchor = (event.target as HTMLElement).closest('a[href]')
        if (!anchor) return false
        window.open((anchor as HTMLAnchorElement).href, '_blank', 'noopener,noreferrer')
        return true
      },
    },
  })
}
