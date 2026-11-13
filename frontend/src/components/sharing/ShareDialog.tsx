import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, ChevronDown, Loader2, Lock, UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/auth-context'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { sharesApi } from '@/lib/api'
import { initials } from '@/lib/format'
import { accessLevel, type AccessLevel, type Share, type UserPublic } from '@/lib/types'
import { cn } from '@/lib/utils'

const PERMISSIONS: { value: AccessLevel; label: string; description: string }[] = [
  { value: 'viewer', label: 'Viewer', description: 'Can view. Can’t download, copy or print.' },
  { value: 'viewer_download', label: 'Viewer + download', description: 'Can view, download, copy and print. Can’t edit.' },
  { value: 'editor', label: 'Editor', description: 'Can view, edit and download. Can’t rename, delete or share.' },
]
const labelFor = (level: AccessLevel) => PERMISSIONS.find((x) => x.value === level)!.label
const levelOf = (share: Share) => accessLevel(share.permission, share.can_download)

function Avatar({ user }: { user: Pick<UserPublic, 'name'> }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {initials(user.name)}
    </span>
  )
}

function PermissionMenu({
  value,
  onChange,
  onRemove,
  disabled,
  label,
}: {
  value: AccessLevel
  onChange: (level: AccessLevel) => void
  onRemove?: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled} aria-label={label} className="shrink-0 gap-1 text-muted-foreground">
          {labelFor(value)}
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {PERMISSIONS.map((p) => (
          <DropdownMenuItem key={p.value} onSelect={() => p.value !== value && onChange(p.value)} className="items-start">
            <Check className={cn('mt-0.5', p.value !== value && 'invisible')} />
            <span>
              <span className="block font-medium">{p.label}</span>
              <span className="block text-xs text-muted-foreground">{p.description}</span>
            </span>
          </DropdownMenuItem>
        ))}
        {onRemove && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onRemove}>
              <UserMinus />
              Remove access
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Owner-only dialog: invite by email, change permissions, revoke access. */
export function ShareDialog({
  docId,
  title,
  open,
  onOpenChange,
}: {
  docId: string
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const [shares, setShares] = useState<Share[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<AccessLevel>('viewer')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [busyUserId, setBusyUserId] = useState<number | null>(null)

  const load = useCallback(() => {
    sharesApi.list(docId).then(
      (list) => {
        setShares(list)
        setLoadError(null)
      },
      (err: Error) => setLoadError(err.message),
    )
  }, [docId])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const invite = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setInviting(true)
    setInviteError(null)
    try {
      const share = await sharesApi.create(docId, trimmed, permission)
      setShares((prev) => [...(prev ?? []), share])
      setEmail('')
      toast.success(`Shared with ${share.user.name}`, { description: `${labelFor(levelOf(share))} access` })
    } catch (err) {
      setInviteError((err as Error).message)
    } finally {
      setInviting(false)
    }
  }

  const changePermission = async (share: Share, next: AccessLevel) => {
    setBusyUserId(share.user.id)
    try {
      const updated = await sharesApi.update(docId, share.user.id, next)
      setShares((prev) => prev?.map((s) => (s.user.id === share.user.id ? updated : s)) ?? prev)
      toast.success(`${share.user.name}: ${labelFor(next)}`)
    } catch (err) {
      toast.error('Couldn’t change permission', { description: (err as Error).message })
    } finally {
      setBusyUserId(null)
    }
  }

  const removeAccess = async (share: Share) => {
    setBusyUserId(share.user.id)
    try {
      await sharesApi.remove(docId, share.user.id)
      setShares((prev) => prev?.filter((s) => s.user.id !== share.user.id) ?? prev)
      toast.success(`Removed ${share.user.name}`)
    } catch (err) {
      toast.error('Couldn’t remove access', { description: (err as Error).message })
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="truncate pr-6">Share “{title}”</DialogTitle>
          <DialogDescription>Invite people with a Quill account by email.</DialogDescription>
        </DialogHeader>

        <form onSubmit={invite} className="space-y-3 px-6 pt-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setInviteError(null)
                }}
                placeholder="name@company.com"
                aria-label="Email address"
                className="h-10 pr-40"
                autoFocus
              />
              <div className="absolute inset-y-0 right-1 flex items-center">
                <PermissionMenu value={permission} onChange={setPermission} label="Permission for new collaborator" />
              </div>
            </div>
            <Button type="submit" className="h-10 px-5" disabled={inviting || !email.trim()}>
              {inviting && <Loader2 className="animate-spin" />}
              Share
            </Button>
          </div>
          <FormError message={inviteError} />
        </form>

        <div className="px-6 pt-6 pb-2">
          <h3 className="text-sm font-medium">People with access</h3>
        </div>
        <ul className="max-h-72 overflow-y-auto px-3 pb-3" aria-label="People with access">
          {user && (
            <li className="flex items-center gap-3 rounded-lg px-3 py-2">
              <Avatar user={user} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.name} (you)</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <span className="px-3 text-sm text-muted-foreground">Owner</span>
            </li>
          )}
          {loadError ? (
            <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-destructive">
              {loadError}
              <Button variant="outline" size="sm" onClick={load}>
                Retry
              </Button>
            </li>
          ) : !shares ? (
            <li className="flex items-center gap-3 px-3 py-2" aria-label="Loading collaborators">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
            </li>
          ) : (
            shares.map((share) => (
              <li key={share.user.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/60" data-testid="collaborator">
                <Avatar user={share.user} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{share.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{share.user.email}</p>
                </div>
                {busyUserId === share.user.id && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                <PermissionMenu
                  value={levelOf(share)}
                  disabled={busyUserId === share.user.id}
                  onChange={(p) => void changePermission(share, p)}
                  onRemove={() => void removeAccess(share)}
                  label={`Permission for ${share.user.name}`}
                />
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center gap-2 rounded-b-lg border-t bg-muted/40 px-6 py-3 text-xs text-muted-foreground">
          <Lock className="size-3.5" />
          Only people you add can open this document.
        </div>
      </DialogContent>
    </Dialog>
  )
}
