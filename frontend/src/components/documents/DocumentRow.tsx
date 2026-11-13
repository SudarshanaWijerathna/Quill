import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { timeAgo } from '@/lib/format'
import type { DocumentSummary } from '@/lib/types'
import { DocumentActions, type DocumentActionHandlers } from './DocumentActions'

/** List row. Rename/delete actions are shown only when handlers are given (i.e. for owners). */
export function DocumentRow({
  doc,
  meta,
  ...actions
}: { doc: DocumentSummary; meta?: ReactNode } & Partial<DocumentActionHandlers>) {
  return (
    <li className="group relative flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/60">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
        <FileText className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <Link
          to={`/documents/${doc.id}`}
          className="block truncate text-sm font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
        >
          {doc.title}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{doc.preview || 'Empty document'}</p>
      </div>
      {meta}
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{timeAgo(doc.updated_at)}</span>
      <DocumentActions doc={doc} {...actions} />
    </li>
  )
}
