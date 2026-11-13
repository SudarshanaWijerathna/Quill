import { AlertCircle, Check, Loader2 } from 'lucide-react'
import type { SaveStatus } from '@/lib/autosave'

/** Saving / Saved / Couldn't save. Labels collapse to icons on small screens (kept for screen readers). */
export function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  const label = 'max-sm:sr-only'
  return (
    <span
      role="status"
      aria-live="polite"
      data-testid="save-status"
      data-status={status}
      className="flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap"
    >
      {status === 'error' ? (
        <>
          <AlertCircle className="size-3.5 text-destructive" />
          <span className={`text-destructive ${label}`}>Couldn’t save</span>
          <button type="button" onClick={onRetry} className="font-medium text-primary hover:underline">
            Retry
          </button>
        </>
      ) : status === 'saved' ? (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Check className="size-3.5" />
          <span className={label}>Saved</span>
        </span>
      ) : (
        <span className="flex items-center gap-1 text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          <span className={label}>Saving…</span>
        </span>
      )}
    </span>
  )
}
