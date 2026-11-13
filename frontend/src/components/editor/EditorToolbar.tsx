import { useEffect, useState, type ReactNode } from 'react'
import { useEditorState, type Editor } from '@tiptap/react'
import {
  Bold,
  ChevronDown,
  Code,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Table as TableIcon,
  Underline,
  Undo2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { CODE_LANGUAGES } from './extensions'
import { LinkDialog } from './LinkDialog'
import { readLinkState, type LinkDialogState } from './link-state'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
const MOD = isMac ? '⌘' : 'Ctrl'

type BlockStyle = 'paragraph' | 'h1' | 'h2' | 'h3'

const BLOCK_STYLES: { value: BlockStyle; label: string; className: string; shortcut: string }[] = [
  { value: 'paragraph', label: 'Normal text', className: 'text-sm', shortcut: `${MOD}+Alt+0` },
  { value: 'h1', label: 'Heading 1', className: 'text-xl font-semibold', shortcut: `${MOD}+Alt+1` },
  { value: 'h2', label: 'Heading 2', className: 'text-lg font-semibold', shortcut: `${MOD}+Alt+2` },
  { value: 'h3', label: 'Heading 3', className: 'text-base font-semibold', shortcut: `${MOD}+Alt+3` },
]

function setBlockStyle(editor: Editor, style: BlockStyle) {
  const chain = editor.chain().focus()
  if (style === 'paragraph') chain.setParagraph().run()
  else chain.setHeading({ level: Number(style[1]) as 1 | 2 | 3 }).run()
}

function ToolbarButton({
  label,
  shortcut,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  shortcut?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors',
        'hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4',
        active && 'bg-accent text-accent-foreground hover:bg-accent',
      )}
    >
      {children}
    </button>
  )
}

const menuTriggerClass =
  'inline-flex h-8 shrink-0 items-center justify-between gap-1 rounded-md px-2.5 text-sm text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40'

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden="true" />
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 items-center gap-0.5">
      {children}
    </div>
  )
}

export function EditorToolbar({
  editor,
  readOnly = false,
  leading,
}: {
  editor: Editor
  /** Viewing mode / view-only access: controls stay visible but disabled. */
  readOnly?: boolean
  /** Rendered at the far left of the toolbar row (the File menu). */
  leading?: ReactNode
}) {
  // Re-renders only when these derived values change (not on every keystroke).
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: (e.isActive('heading', { level: 1 })
        ? 'h1'
        : e.isActive('heading', { level: 2 })
          ? 'h2'
          : e.isActive('heading', { level: 3 })
            ? 'h3'
            : 'paragraph') as BlockStyle,
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      taskList: e.isActive('taskList'),
      blockquote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      codeLanguage: (e.getAttributes('codeBlock').language as string | null) ?? null,
      table: e.isActive('table'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      editable: e.isEditable,
    }),
  })

  const [linkDialog, setLinkDialog] = useState<LinkDialogState | null>(null)
  const [linkDialogKey, setLinkDialogKey] = useState(0)
  const openLinkDialog = () => {
    setLinkDialog(readLinkState(editor))
    setLinkDialogKey((k) => k + 1)
  }

  // Ctrl/Cmd+K opens the link dialog while the editor has focus.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && editor.isFocused && editor.isEditable) {
        e.preventDefault()
        setLinkDialog(readLinkState(editor))
        setLinkDialogKey((k) => k + 1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editor])

  const current = BLOCK_STYLES.find((s) => s.value === state.block)!
  const disabled = readOnly || !state.editable
  const run = (fn: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => () => fn(editor.chain().focus()).run()
  const languageLabel =
    CODE_LANGUAGES.find((l) => l.value === state.codeLanguage)?.label ?? (state.codeLanguage || 'Auto-detect')

  return (
    <>
      <div className="flex items-center">
      {leading && <div className="flex shrink-0 items-center border-r px-2">{leading}</div>}
      <div
        role="toolbar"
        aria-disabled={disabled || undefined}
        aria-label="Formatting"
        className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-3 py-1.5 [scrollbar-width:thin] lg:justify-center"
      >
        <Group label="History">
          <ToolbarButton label="Undo" shortcut={`${MOD}+Z`} disabled={disabled || !state.canUndo} onClick={run((c) => c.undo())}>
            <Undo2 />
          </ToolbarButton>
          <ToolbarButton label="Redo" shortcut={`${MOD}+Shift+Z`} disabled={disabled || !state.canRedo} onClick={run((c) => c.redo())}>
            <Redo2 />
          </ToolbarButton>
        </Group>
        <Divider />

        <Group label="Text style">
          <DropdownMenu>
            <DropdownMenuTrigger disabled={disabled} aria-label="Text style" className={cn(menuTriggerClass, 'w-36')}>
              {current.label}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52" onCloseAutoFocus={(e) => e.preventDefault()}>
              {BLOCK_STYLES.map((style) => (
                <DropdownMenuItem
                  key={style.value}
                  onSelect={() => setBlockStyle(editor, style.value)}
                  className={cn('justify-between', style.value === state.block && 'bg-accent/60')}
                >
                  <span className={style.className}>{style.label}</span>
                  <span className="text-xs text-muted-foreground">{style.shortcut}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <ToolbarButton label="Heading 1" shortcut={`${MOD}+Alt+1`} active={state.block === 'h1'} disabled={disabled} onClick={run((c) => c.toggleHeading({ level: 1 }))}>
            <Heading1 />
          </ToolbarButton>
          <ToolbarButton label="Heading 2" shortcut={`${MOD}+Alt+2`} active={state.block === 'h2'} disabled={disabled} onClick={run((c) => c.toggleHeading({ level: 2 }))}>
            <Heading2 />
          </ToolbarButton>
        </Group>
        <Divider />

        <Group label="Text formatting">
          <ToolbarButton label="Bold" shortcut={`${MOD}+B`} active={state.bold} disabled={disabled} onClick={run((c) => c.toggleBold())}>
            <Bold />
          </ToolbarButton>
          <ToolbarButton label="Italic" shortcut={`${MOD}+I`} active={state.italic} disabled={disabled} onClick={run((c) => c.toggleItalic())}>
            <Italic />
          </ToolbarButton>
          <ToolbarButton label="Underline" shortcut={`${MOD}+U`} active={state.underline} disabled={disabled} onClick={run((c) => c.toggleUnderline())}>
            <Underline />
          </ToolbarButton>
          <ToolbarButton label="Strikethrough" shortcut={`${MOD}+Shift+S`} active={state.strike} disabled={disabled} onClick={run((c) => c.toggleStrike())}>
            <Strikethrough />
          </ToolbarButton>
          <ToolbarButton label="Inline code" shortcut={`${MOD}+E`} active={state.code} disabled={disabled} onClick={run((c) => c.toggleCode())}>
            <Code />
          </ToolbarButton>
          <ToolbarButton label={state.link ? 'Edit link' : 'Insert link'} shortcut={`${MOD}+K`} active={state.link} disabled={disabled || state.codeBlock} onClick={openLinkDialog}>
            <Link2 />
          </ToolbarButton>
        </Group>
        <Divider />

        <Group label="Lists">
          <ToolbarButton label="Bulleted list" shortcut={`${MOD}+Shift+8`} active={state.bulletList} disabled={disabled} onClick={run((c) => c.toggleBulletList())}>
            <List />
          </ToolbarButton>
          <ToolbarButton label="Numbered list" shortcut={`${MOD}+Shift+7`} active={state.orderedList} disabled={disabled} onClick={run((c) => c.toggleOrderedList())}>
            <ListOrdered />
          </ToolbarButton>
          <ToolbarButton label="Checklist" shortcut={`${MOD}+Shift+9`} active={state.taskList} disabled={disabled} onClick={run((c) => c.toggleTaskList())}>
            <ListChecks />
          </ToolbarButton>
        </Group>
        <Divider />

        <Group label="Blocks">
          <ToolbarButton label="Quote" shortcut={`${MOD}+Shift+B`} active={state.blockquote} disabled={disabled} onClick={run((c) => c.toggleBlockquote())}>
            <Quote />
          </ToolbarButton>
          <ToolbarButton label="Code block" shortcut={`${MOD}+Alt+C`} active={state.codeBlock} disabled={disabled} onClick={run((c) => c.toggleCodeBlock())}>
            <SquareCode />
          </ToolbarButton>
          <ToolbarButton
            label="Insert table"
            disabled={disabled || state.table}
            onClick={run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))}
          >
            <TableIcon />
          </ToolbarButton>
          <ToolbarButton label="Divider" disabled={disabled} onClick={run((c) => c.setHorizontalRule())}>
            <Minus />
          </ToolbarButton>
        </Group>

        {/* Contextual controls */}
        {state.table && !disabled && (
          <>
            <Divider />
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="Table options" className={menuTriggerClass}>
                <TableIcon className="size-4 text-muted-foreground" />
                Table
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52" onCloseAutoFocus={(e) => e.preventDefault()}>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Rows</DropdownMenuLabel>
                <DropdownMenuItem onSelect={run((c) => c.addRowBefore())}>Insert row above</DropdownMenuItem>
                <DropdownMenuItem onSelect={run((c) => c.addRowAfter())}>Insert row below</DropdownMenuItem>
                <DropdownMenuItem onSelect={run((c) => c.deleteRow())}>Delete row</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">Columns</DropdownMenuLabel>
                <DropdownMenuItem onSelect={run((c) => c.addColumnBefore())}>Insert column left</DropdownMenuItem>
                <DropdownMenuItem onSelect={run((c) => c.addColumnAfter())}>Insert column right</DropdownMenuItem>
                <DropdownMenuItem onSelect={run((c) => c.deleteColumn())}>Delete column</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={run((c) => c.toggleHeaderRow())}>Toggle header row</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={run((c) => c.deleteTable())}>
                  Delete table
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        {state.codeBlock && !disabled && (
          <>
            <Divider />
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="Code language" className={cn(menuTriggerClass, 'min-w-32')}>
                {languageLabel}
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 w-48 overflow-y-auto" onCloseAutoFocus={(e) => e.preventDefault()}>
                <DropdownMenuItem onSelect={run((c) => c.updateAttributes('codeBlock', { language: null }))}>
                  Auto-detect
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {CODE_LANGUAGES.map((lang) => (
                  <DropdownMenuItem
                    key={lang.value}
                    onSelect={run((c) => c.updateAttributes('codeBlock', { language: lang.value }))}
                    className={cn(lang.value === state.codeLanguage && 'bg-accent/60')}
                  >
                    {lang.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
      </div>

      <LinkDialog key={linkDialogKey} editor={editor} state={linkDialog} onClose={() => setLinkDialog(null)} />
    </>
  )
}
