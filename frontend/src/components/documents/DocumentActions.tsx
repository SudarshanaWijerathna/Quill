import { Download, FileText, MoreHorizontal, Pencil, Share2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ExportFormat } from '@/lib/api'
import { downloadDocument } from '@/lib/download'
import type { DocumentSummary } from '@/lib/types'

export interface DocumentActionHandlers {
  onRename: (doc: DocumentSummary) => void
  onDelete: (doc: DocumentSummary) => void
  onShare?: (doc: DocumentSummary) => void
}

/**
 * Card/row menu. Rename, Share and Delete are owner-only; Download needs download permission.
 * The API enforces the same rules; this only hides what the user can't do.
 */
export function DocumentActions({ doc, onRename, onDelete, onShare }: { doc: DocumentSummary } & Partial<DocumentActionHandlers>) {
  const isOwner = doc.role === 'owner'
  const download = async (format: ExportFormat) => {
    try {
      await downloadDocument(doc.id, format)
    } catch (err) {
      toast.error('Download failed', { description: (err as Error).message })
    }
  }
  if (!isOwner && !doc.can_download) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative z-10 size-8 text-muted-foreground"
          aria-label={`Actions for ${doc.title}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {isOwner && onRename && (
          <DropdownMenuItem onSelect={() => onRename(doc)}>
            <Pencil />
            Rename
          </DropdownMenuItem>
        )}
        {isOwner && onShare && (
          <DropdownMenuItem onSelect={() => onShare(doc)}>
            <Share2 />
            Share
          </DropdownMenuItem>
        )}
        {doc.can_download && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Download className="size-4 text-muted-foreground" />
              Download
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              <DropdownMenuItem onSelect={() => void download('markdown')}>
                <FileText />
                Markdown (.md)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download('text')}>
                <FileText />
                Plain text (.txt)
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {isOwner && onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(doc)}>
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
