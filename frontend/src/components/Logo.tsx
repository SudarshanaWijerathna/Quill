import { cn } from '@/lib/utils'

/** Quill logo: the brand mark (public/quill.svg) plus the wordmark. */
export function Logo({
  className,
  inverted = false,
  iconOnly = false,
}: {
  className?: string
  /** On the navy brand panel: the mark sits on a white tile so it stays visible. */
  inverted?: boolean
  iconOnly?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg',
          inverted ? 'bg-white' : 'bg-transparent',
        )}
      >
        <img src="/quill.svg" alt="" aria-hidden="true" className="size-6" data-testid="logo-mark" />
      </span>
      <span
        className={cn(
          'text-lg font-semibold tracking-tight',
          inverted ? 'text-white' : 'text-foreground',
          iconOnly && 'sr-only',
        )}
      >
        Quill
      </span>
    </span>
  )
}
