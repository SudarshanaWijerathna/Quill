import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { timeAgo } from '@/lib/format'
import type { DocumentSummary } from '@/lib/types'
import { DocumentActions, type DocumentActionHandlers } from './DocumentActions'

/** Grid card with a page-like preview. The title link stretches over the whole card. */
export function DocumentCard({ doc, ...actions }: { doc: DocumentSummary } & Partial<DocumentActionHandlers>) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl bg-card ring-1 ring-border transition-shadow hover:shadow-md hover:ring-primary/20">
      <div className="h-32 border-b bg-muted/50 px-5 pt-5">
        <div className="h-full rounded-t-md bg-background px-4 pt-3 shadow-xs ring-1 ring-border/70">
          {doc.preview ? (
            <p className="line-clamp-4 text-[11px] leading-relaxed text-muted-foreground">{doc.preview}</p>
          ) : (
            <div className="space-y-1.5 pt-1">
              <div className="h-1.5 w-3/4 rounded bg-muted" />
              <div className="h-1.5 w-1/2 rounded bg-muted" />
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <FileText className="size-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <Link
            to={`/documents/${doc.id}`}
            className="block truncate text-sm font-medium after:absolute after:inset-0 focus-visible:outline-none after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {doc.title}
          </Link>
          <p className="text-xs text-muted-foreground">Edited {timeAgo(doc.updated_at)}</p>
        </div>
        <DocumentActions doc={doc} {...actions} />
      </div>
    </div>
  )
}
