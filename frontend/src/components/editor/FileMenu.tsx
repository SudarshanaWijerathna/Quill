import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, FileDown, FileText, FileType, Lock, Printer } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { documentsApi, exportDocument, type ExportFormat } from '@/lib/api'
import { saveBlob } from '@/lib/download'
import type { DocumentDetail } from '@/lib/types'


/**
 * File menu. Copy and Markdown/TXT downloads are permission-checked by the API; PDF and Print use
 * the browser's print pipeline and are only offered when the user may download.
 */
export function FileMenu({
  doc,
  flushPendingSaves,
}: {
  doc: DocumentDetail
  /** Saves pending edits first, so copies/exports include them. Resolves false if that failed. */
  flushPendingSaves: () => Promise<boolean>
}) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const allowed = doc.can_download

  const withSavedContent = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try {
      if (!(await flushPendingSaves())) {
        toast.error('Your latest changes aren’t saved yet', { description: 'Retry saving, then try again.' })
        return
      }
      await action()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const makeCopy = () =>
    withSavedContent(async () => {
      const copy = await documentsApi.copy(doc.id)
      toast.success('Copy created', { description: copy.title })
      navigate(`/documents/${copy.id}`)
    })

  const download = (format: ExportFormat) =>
    withSavedContent(async () => {
      const { blob, filename } = await exportDocument(doc.id, format)
      saveBlob(blob, filename)
    })

  const print = (asPdf: boolean) =>
    withSavedContent(async () => {
      if (asPdf) toast('Choose “Save as PDF” as the destination in the print dialog.')
      // Let the menu close and the toast render before the (blocking) print dialog opens.
      await new Promise((r) => setTimeout(r, 150))
      window.print()
    })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-7 shrink-0 items-center rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none print:hidden"
        aria-label="File menu"
      >
        File
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {!allowed && (
          <>
            <DropdownMenuLabel className="flex items-start gap-2 text-xs font-normal text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              The owner hasn’t allowed downloading, copying or printing this document.
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem disabled={!allowed || busy} onSelect={() => void makeCopy()}>
          <Copy />
          Make a copy
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={!allowed}>
            <FileDown className="size-4 text-muted-foreground" />
            Download
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            <DropdownMenuItem disabled={busy} onSelect={() => void print(true)}>
              <FileType />
              PDF document (.pdf)
            </DropdownMenuItem>
            <DropdownMenuItem disabled={busy} onSelect={() => void download('markdown')}>
              <FileText />
              Markdown (.md)
            </DropdownMenuItem>
            <DropdownMenuItem disabled={busy} onSelect={() => void download('text')}>
              <FileText />
              Plain text (.txt)
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!allowed || busy} onSelect={() => void print(false)}>
          <Printer />
          Print
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
