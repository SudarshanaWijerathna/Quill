import { Eye, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

export type EditorMode = 'editing' | 'viewing'

/**
 * Editing / Viewing presentation mode for users who are allowed to edit. It only changes the UI;
 * permissions are enforced by the backend (viewers never see this control).
 */
export function ModeToggle({ mode, onChange }: { mode: EditorMode; onChange: (mode: EditorMode) => void }) {
  const option = (value: EditorMode, label: string, Icon: typeof Eye) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === value}
      onClick={() => onChange(value)}
      title={value === 'editing' ? 'Editing: change the document' : 'Viewing: read without changing anything'}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        mode === value ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="size-3.5" />
      <span className="hidden md:inline">{label}</span>
    </button>
  )
  return (
    <div role="radiogroup" aria-label="Mode" className="flex shrink-0 items-center rounded-lg bg-muted p-0.5 print:hidden">
      {option('editing', 'Editing', Pencil)}
      {option('viewing', 'Viewing', Eye)}
    </div>
  )
}
