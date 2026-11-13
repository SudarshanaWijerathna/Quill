import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, FilePlus2, Loader2, Plus, Search, SearchX, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/auth-context'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { DocumentCard } from '@/components/documents/DocumentCard'
import { DeleteDialog, RenameDialog } from '@/components/documents/DocumentDialogs'
import { ImportDialog } from '@/components/documents/ImportDialog'
import { ShareDialog } from '@/components/sharing/ShareDialog'
import { DocumentRow } from '@/components/documents/DocumentRow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { documentsApi } from '@/lib/api'
import { greeting } from '@/lib/format'
import type { DocumentSummary } from '@/lib/types'

const RECENT_COUNT = 4

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [docs, setDocs] = useState<DocumentSummary[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [sharing, setSharing] = useState<DocumentSummary | null>(null)
  const [renaming, setRenaming] = useState<DocumentSummary | null>(null)
  const [deleting, setDeleting] = useState<DocumentSummary | null>(null)

  const load = useCallback(() => {
    documentsApi
      .list()
      .then((list) => {
        setDocs(list)
        setLoadError(null)
      })
      .catch((err: Error) => setLoadError(err.message))
  }, [])

  useEffect(load, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!docs || !q) return docs
    return docs.filter((d) => d.title.toLowerCase().includes(q) || d.preview.toLowerCase().includes(q))
  }, [docs, query])

  const createDocument = async () => {
    setCreating(true)
    try {
      const doc = await documentsApi.create()
      navigate(`/documents/${doc.id}`)
    } catch (err) {
      toast.error('Could not create document', { description: (err as Error).message })
      setCreating(false)
    }
  }

  const renameDocument = async (doc: DocumentSummary, title: string) => {
    const updated = await documentsApi.update(doc.id, { title })
    setDocs((prev) =>
      prev
        ? [{ ...doc, title: updated.title, updated_at: updated.updated_at }, ...prev.filter((d) => d.id !== doc.id)]
        : prev,
    )
    toast.success('Document renamed')
  }

  const deleteDocument = async (doc: DocumentSummary) => {
    await documentsApi.remove(doc.id)
    setDocs((prev) => prev?.filter((d) => d.id !== doc.id) ?? prev)
    toast.success('Document deleted')
  }

  const actions = { onRename: setRenaming, onDelete: setDeleting, onShare: setSharing }
  const isSearching = query.trim().length > 0
  const firstName = user?.name.split(' ')[0]

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description="Pick up where you left off, or start something new."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)} className="h-10 px-4">
              <Upload />
              Import
            </Button>
            <Button onClick={createDocument} disabled={creating} className="h-10 px-4">
              {creating ? <Loader2 className="animate-spin" /> : <Plus />}
              New document
            </Button>
          </>
        }
      />

      <div className="relative mt-8 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search documents"
          aria-label="Search documents"
          className="h-10 bg-muted/50 pl-9"
        />
      </div>

      <div className="mt-10">
        {loadError && !docs ? (
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load your documents"
            description={loadError}
            action={
              <Button variant="outline" onClick={load}>
                Try again
              </Button>
            }
          />
        ) : !docs ? (
          <LoadingSkeleton />
        ) : docs.length === 0 ? (
          <EmptyState
            icon={FilePlus2}
            title="No documents yet"
            description="Create your first document to start writing, or import a .txt or .md file."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={createDocument} disabled={creating}>
                  {creating ? <Loader2 className="animate-spin" /> : <Plus />}
                  Create a document
                </Button>
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  <Upload />
                  Import a file
                </Button>
              </div>
            }
          />
        ) : isSearching ? (
          <section>
            <SectionTitle>
              {filtered!.length} result{filtered!.length === 1 ? '' : 's'} for “{query.trim()}”
            </SectionTitle>
            {filtered!.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No matching documents"
                description="Try a different title or keyword."
              />
            ) : (
              <DocumentList docs={filtered!} {...actions} />
            )}
          </section>
        ) : (
          <div className="space-y-12">
            <section>
              <SectionTitle>Recent</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {docs.slice(0, RECENT_COUNT).map((doc) => (
                  <DocumentCard key={doc.id} doc={doc} {...actions} />
                ))}
              </div>
            </section>
            {docs.length > RECENT_COUNT && (
              <section>
                <SectionTitle>All documents</SectionTitle>
                <DocumentList docs={docs} {...actions} />
              </section>
            )}
          </div>
        )}
      </div>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      {sharing && (
        <ShareDialog docId={sharing.id} title={sharing.title} open onOpenChange={(open) => !open && setSharing(null)} />
      )}
      <RenameDialog
        key={`rename-${renaming?.id}`}
        doc={renaming}
        onClose={() => setRenaming(null)}
        onRename={renameDocument}
      />
      <DeleteDialog
        key={`delete-${deleting?.id}`}
        doc={deleting}
        onClose={() => setDeleting(null)}
        onDelete={deleteDocument}
      />
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-sm font-medium text-muted-foreground">{children}</h2>
}

function DocumentList({
  docs,
  ...actions
}: { docs: DocumentSummary[] } & Pick<React.ComponentProps<typeof DocumentRow>, 'onRename' | 'onDelete' | 'onShare'>) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl bg-card ring-1 ring-border">
      {docs.map((doc) => (
        <DocumentRow key={doc.id} doc={doc} {...actions} />
      ))}
    </ul>
  )
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Loading documents">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl ring-1 ring-border">
          <Skeleton className="h-32 rounded-none" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
