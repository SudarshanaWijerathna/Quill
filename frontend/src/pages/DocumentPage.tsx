import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EditorContent, useEditorState } from '@tiptap/react'
import { AlertTriangle, ArrowLeft, Eye, FileQuestion, Pencil, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/EmptyState'
import { Logo } from '@/components/Logo'
import { ShareDialog } from '@/components/sharing/ShareDialog'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserAvatarMenu } from '@/components/UserAvatarMenu'
import { FileMenu } from '@/components/editor/FileMenu'
import { ModeToggle, type EditorMode } from '@/components/editor/ModeToggle'
import { StatusBar } from '@/components/editor/StatusBar'
import { EditorToolbar } from '@/components/editor/EditorToolbar'
import { SaveIndicator } from '@/components/editor/SaveIndicator'
import { useDocumentEditor } from '@/components/editor/useDocumentEditor'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, documentsApi } from '@/lib/api'
import { Autosaver, type SaveStatus } from '@/lib/autosave'
import type { DocumentContent, DocumentDetail, Role } from '@/lib/types'

const AUTOSAVE_DELAY_MS = 800

/** Route entry. Keyed by id so switching documents fully remounts (no state or saves leak across). */
export default function DocumentRoute() {
  const { id = '' } = useParams()
  return <DocumentLoader key={id} id={id} />
}

function DocumentLoader({ id }: { id: string }) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    documentsApi.get(id).then(setDoc, (err: ApiError) => setError(err))
  }, [id])

  if (error) {
    const notFound = error.status === 404
    return (
      <div className="mx-auto max-w-xl px-4 py-24">
        <EmptyState
          icon={FileQuestion}
          title={notFound ? 'Document not found' : 'Couldn’t open this document'}
          description={notFound ? "This document doesn't exist or you don't have access to it." : error.message}
          action={
            <Button asChild variant="outline">
              <Link to="/">Back to documents</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return doc ? <DocumentWorkspace doc={doc} /> : <WorkspaceSkeleton />
}

/** 403/404 on save means edit access was removed (or the document deleted): retrying won't help. */
const isAccessLost = (err?: Error) => err instanceof ApiError && (err.status === 403 || err.status === 404)

function DocumentWorkspace({ doc }: { doc: DocumentDetail }) {
  // The backend enforces these too; the UI just hides what the user can't do.
  const isOwner = doc.role === 'owner'
  const canEdit = doc.role !== 'viewer'

  // ---- Content autosave ------------------------------------------------------------------------
  const saverRef = useRef<Autosaver<DocumentContent> | null>(null)
  const [contentStatus, setContentStatus] = useState<SaveStatus>('saved')
  const [contentError, setContentError] = useState<string | null>(null)
  const [accessLost, setAccessLost] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  // Presentation mode only; editing permission itself comes from the backend role.
  const [mode, setMode] = useState<EditorMode>('editing')
  const [zoom, setZoom] = useState(100)
  const editingActive = canEdit && !accessLost && mode === 'editing'

  const editor = useDocumentEditor({
    content: doc.content,
    editable: canEdit,
    onChange: (json) => saverRef.current?.update(json),
    onContentError: (err) => setContentError(err.message),
  })

  useEffect(() => {
    if (!canEdit) return // viewers never save
    // Created in an effect (not during render) so React StrictMode's mount/unmount/mount cycle
    // disposes and recreates it cleanly. Disposal flushes pending changes before navigation.
    const saver = new Autosaver<DocumentContent>({
      initial: doc.content,
      delay: AUTOSAVE_DELAY_MS,
      save: (content, { keepalive }) => documentsApi.update(doc.id, { content }, { keepalive }),
      shouldRetry: (err) => !isAccessLost(err),
      onStatusChange: (next, err) => {
        setContentStatus(next)
        if (isAccessLost(err)) {
          editor.setEditable(false)
          setAccessLost(true)
        }
      },
    })
    saver.resetBaseline(editor.getJSON() as DocumentContent)
    saverRef.current = saver
    return () => {
      saver.dispose()
      saverRef.current = null
    }
  }, [doc.id, doc.content, editor, canEdit])

  useEffect(() => {
    // emitUpdate=false: switching modes is not a content change, so it never triggers autosave.
    if (editor.isEditable !== editingActive) editor.setEditable(editingActive, false)
  }, [editor, editingActive])

  /** For copy/export: save pending edits first. Resolves false if saving failed. */
  const flushPendingSaves = useCallback(async () => {
    const saver = saverRef.current
    if (!saver) return true
    await saver.flush()
    return !saver.hasUnsavedChanges
  }, [])

  // ---- Title -------------------------------------------------------------------------------------
  const [title, setTitle] = useState(doc.title)
  const savedTitle = useRef(doc.title)
  const [titleStatus, setTitleStatus] = useState<'idle' | 'saving' | 'error'>('idle')

  const saveTitle = useCallback(async () => {
    const trimmed = title.trim()
    if (!trimmed) {
      setTitle(savedTitle.current)
      return
    }
    if (trimmed === savedTitle.current) {
      if (trimmed !== title) setTitle(trimmed)
      return
    }
    setTitleStatus('saving')
    try {
      const updated = await documentsApi.update(doc.id, { title: trimmed })
      savedTitle.current = updated.title
      setTitle((current) => (current.trim() === trimmed ? updated.title : current))
      setTitleStatus('idle')
    } catch (err) {
      setTitleStatus('error')
      toast.error('Couldn’t rename document', { description: (err as Error).message })
    }
  }, [doc.id, title])

  // Leaving without blurring the title (e.g. browser Back) still saves a pending rename.
  const titleRef = useRef(title)
  useEffect(() => {
    titleRef.current = title
  }, [title])
  useEffect(() => {
    if (!isOwner) return // only owners can rename
    return () => {
      const pending = titleRef.current.trim()
      if (pending && pending !== savedTitle.current) {
        void documentsApi.update(doc.id, { title: pending }, { keepalive: true }).catch(() => {
          toast.error('Couldn’t save the new title')
        })
      }
    }
  }, [doc.id, isOwner])

  const onTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      editor.commands.focus('start')
    } else if (e.key === 'Escape') {
      setTitle(savedTitle.current)
      e.currentTarget.blur()
    }
  }

  // ---- Combined status, shortcuts and unload handling -----------------------------------------
  const status: SaveStatus =
    contentStatus === 'error' || titleStatus === 'error'
      ? 'error'
      : contentStatus !== 'saved' || titleStatus === 'saving'
        ? 'saving'
        : 'saved'

  const retry = () => {
    void saverRef.current?.flush()
    if (titleStatus === 'error') void saveTitle()
  }

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault() // Ctrl/Cmd+S saves immediately instead of opening "Save page as"
        void saverRef.current?.flush()
      }
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const saver = saverRef.current
      if (saver?.hasUnsavedChanges) {
        saver.flushOnUnload()
        e.preventDefault() // ask the browser to confirm leaving with unsaved changes
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void saverRef.current?.flush()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const words = useEditorState({
    editor,
    selector: ({ editor: e }) => e.storage.characterCount.words() as number,
  })

  const titleEditable = isOwner && mode === 'editing'

  return (
    <div className="flex min-h-screen flex-col bg-muted/50" {...(!doc.can_download ? { 'data-print-blocked': '' } : {})}>
      <header className="sticky top-0 z-20 border-b bg-background print:hidden">
        <div className="flex items-center gap-1.5 px-2 py-2 sm:gap-2 sm:px-4">
          <Button asChild variant="ghost" size="icon" aria-label="Back to documents" title="Back to documents" className="shrink-0">
            <Link to="/">
              <ArrowLeft />
            </Link>
          </Button>
          <Link to="/" className="hidden shrink-0 sm:block" aria-label="Quill home">
            <Logo iconOnly />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-w-0 items-center gap-2">
              {titleEditable ? (
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => void saveTitle()}
                  onKeyDown={onTitleKeyDown}
                  maxLength={200}
                  aria-label="Document title"
                  className="w-full min-w-0 truncate rounded-md bg-transparent px-2 py-0.5 text-base font-medium outline-none hover:bg-muted focus:bg-background focus:ring-2 focus:ring-ring sm:max-w-md"
                />
              ) : (
                <h1 className="truncate px-2 py-0.5 text-base font-medium sm:max-w-md" data-testid="document-title">
                  {title || doc.title}
                </h1>
              )}
              {!isOwner && (
                <RoleBadge role={accessLost ? 'viewer' : doc.role} canDownload={doc.can_download} ownerName={doc.owner.name} />
              )}
            </div>
          </div>

          {/* Right side: mode, theme, save status, Share, avatar */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {canEdit && !accessLost && <ModeToggle mode={mode} onChange={setMode} />}
            <ThemeToggle className="text-muted-foreground" />
            {canEdit && !accessLost && <SaveIndicator status={status} onRetry={retry} />}
            {isOwner && (
              <Button variant="outline" className="shrink-0" onClick={() => setShareOpen(true)} aria-label="Share">
                <Share2 />
                <span className="hidden sm:inline">Share</span>
              </Button>
            )}
            <UserAvatarMenu />
          </div>
        </div>
        {/* Always visible; formatting is disabled when viewing (permissions are enforced by the API). */}
        <div className="border-t">
          <EditorToolbar
            editor={editor}
            readOnly={!editingActive}
            trailing={<FileMenu doc={doc} flushPendingSaves={flushPendingSaves} />}
          />
        </div>
      </header>

      {(doc.role === 'viewer' || accessLost) && (
        <div role="note" className="flex items-center justify-center gap-2 border-b bg-accent/60 px-4 py-2 text-center text-sm text-accent-foreground print:hidden">
          <Eye className="size-4 shrink-0" />
          {accessLost
            ? 'Your edit access to this document was removed. Recent changes may not have been saved.'
            : `You have view-only access${doc.can_download ? ' (downloads allowed)' : ''}. Ask ${doc.owner.name} if you need to make changes.`}
        </div>
      )}

      {isOwner && <ShareDialog docId={doc.id} title={title || doc.title} open={shareOpen} onOpenChange={setShareOpen} />}

      {contentError && (
        <div role="alert" className="flex items-center justify-center gap-2 bg-destructive/8 px-4 py-2 text-sm text-destructive print:hidden">
          <AlertTriangle className="size-4" />
          This document contains content Quill can’t display, so editing is disabled to protect it.
        </div>
      )}

      {/* pb-24 keeps the last lines clear of the fixed status bar */}
      <main className="flex-1 overflow-x-auto pb-24 sm:px-6 sm:pt-10 print:overflow-visible print:p-0">
        <div
          data-testid="document-canvas"
          style={{ zoom: zoom / 100 }}
          className="quill-print-page mx-auto min-h-[calc(100vh-7rem)] w-full max-w-[816px] cursor-text bg-background px-5 py-8 sm:min-h-[1056px] sm:rounded-sm sm:px-16 sm:py-16 sm:shadow-sm sm:ring-1 sm:ring-border"
          onMouseDown={(e) => {
            // Clicking the page margin focuses the editor (end of document).
            if (e.target === e.currentTarget) {
              e.preventDefault()
              editor.commands.focus('end')
            }
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </main>
      <StatusBar zoom={zoom} onZoomChange={setZoom} words={words} />
    </div>
  )
}

function RoleBadge({ role, canDownload, ownerName }: { role: Role; canDownload: boolean; ownerName: string }) {
  const viewer = role === 'viewer'
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs whitespace-nowrap text-muted-foreground"
      title={`Shared by ${ownerName}`}
      data-testid="role-badge"
    >
      {viewer ? <Eye className="size-3" /> : <Pencil className="size-3" />}
      {viewer ? (canDownload ? 'View & download' : 'View only') : 'Can edit'}
      <span className="hidden lg:inline">· Shared by {ownerName}</span>
    </span>
  )
}

function WorkspaceSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/50" aria-label="Loading document">
      <div className="flex items-center gap-3 border-b bg-background px-4 py-3">
        <Skeleton className="size-8" />
        <Skeleton className="h-6 w-56" />
      </div>
      <div className="h-11 border-b bg-background" />
      <div className="mx-auto mt-10 w-full max-w-[816px] space-y-4 bg-background px-16 py-16 shadow-sm">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}
