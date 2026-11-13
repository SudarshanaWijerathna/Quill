import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Download, Eye, Pencil, Search, SearchX, Trash2, Users } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { DocumentRow } from '@/components/documents/DocumentRow'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { documentsApi } from '@/lib/api'
import type { DocumentSummary } from '@/lib/types'

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-8 sm:py-10">{children}</div>
}

function SharedMeta({ doc }: { doc: DocumentSummary }) {
  const viewer = doc.role === 'viewer'
  return (
    <div className="hidden shrink-0 items-center gap-3 md:flex">
      <span className="max-w-48 truncate text-xs text-muted-foreground" title={doc.owner.email}>
        Shared by {doc.owner.name}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs whitespace-nowrap text-muted-foreground">
        {viewer ? doc.can_download ? <Download className="size-3" /> : <Eye className="size-3" /> : <Pencil className="size-3" />}
        {viewer ? (doc.can_download ? 'View & download' : 'View only') : 'Can edit'}
      </span>
    </div>
  )
}

export function SharedPage() {
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const load = useCallback(() => {
    documentsApi.sharedWithMe().then(
      (list) => {
        setDocs(list)
        setError(null)
      },
      (err: Error) => setError(err.message),
    )
  }, [])
  useEffect(load, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!docs || !q) return docs
    return docs.filter(
      (d) => d.title.toLowerCase().includes(q) || d.owner.name.toLowerCase().includes(q) || d.preview.toLowerCase().includes(q),
    )
  }, [docs, query])

  return (
    <Shell>
      <PageHeader title="Shared with me" description="Documents other people have shared with you." />

      {docs && docs.length > 0 && (
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shared documents"
            aria-label="Search shared documents"
            className="h-10 bg-muted/50 pl-9"
          />
        </div>
      )}

      {error && !docs ? (
        <EmptyState icon={AlertCircle} title="Couldn't load shared documents" description={error} />
      ) : !docs ? (
        <div className="space-y-2" aria-label="Loading shared documents">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nothing shared with you yet"
          description="When someone shares a document with you, it will appear here."
        />
      ) : filtered!.length === 0 ? (
        <EmptyState icon={SearchX} title="No matching documents" description="Try a different title or name." />
      ) : (
        <section>
          <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-border" aria-label="Shared documents">
            {filtered!.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} meta={<SharedMeta doc={doc} />} />
            ))}
          </ul>
        </section>
      )}
    </Shell>
  )
}

export function TrashPage() {
  return (
    <Shell>
      <PageHeader title="Trash" description="Recently deleted documents." />
      <EmptyState
        icon={Trash2}
        title="Trash is empty"
        description="Deleting a document currently removes it permanently. Restorable trash is planned."
      />
    </Shell>
  )
}
