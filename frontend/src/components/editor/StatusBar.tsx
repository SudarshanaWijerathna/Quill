import { Minus, Plus } from 'lucide-react'
import { clampZoom, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '@/lib/zoom'

/** Fixed bottom-right control: zoom (document canvas only) and word count. */
export function StatusBar({
  zoom,
  onZoomChange,
  words,
}: {
  zoom: number
  onZoomChange: (zoom: number) => void
  words: number
}) {
  const btn =
    'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40'
  return (
    <div
      role="group"
      aria-label="Document status"
      data-testid="status-bar"
      className="fixed right-3 bottom-3 z-30 flex items-center gap-1 rounded-xl bg-popover/95 px-1.5 py-1 text-xs text-muted-foreground shadow-md ring-1 ring-border backdrop-blur sm:right-5 sm:bottom-5 print:hidden"
    >
      <button type="button" className={btn} onClick={() => onZoomChange(clampZoom(zoom - ZOOM_STEP))} disabled={zoom <= ZOOM_MIN} aria-label="Zoom out" title="Zoom out">
        <Minus className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onZoomChange(100)}
        className="h-7 w-12 rounded-md text-center font-medium tabular-nums text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`Zoom ${zoom}%. Reset to 100%`}
        title="Reset to 100%"
        data-testid="zoom-level"
      >
        {zoom}%
      </button>
      <button type="button" className={btn} onClick={() => onZoomChange(clampZoom(zoom + ZOOM_STEP))} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in" title="Zoom in">
        <Plus className="size-3.5" />
      </button>
      <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
      <span className="pr-1.5 pl-0.5 whitespace-nowrap tabular-nums" data-testid="word-count">
        {words.toLocaleString()} {words === 1 ? 'word' : 'words'}
      </span>
    </div>
  )
}
