import type { AnyExtension } from '@tiptap/core'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { CharacterCount, Placeholder } from '@tiptap/extensions'
import StarterKit from '@tiptap/starter-kit'
import { common, createLowlight } from 'lowlight'
import { isSafeUrl } from '@/lib/links'

/** highlight.js "common" grammars (~35 popular languages); bundled with the lazily loaded editor. */
export const lowlight = createLowlight(common)

/** Languages offered in the code block picker (any registered language/alias still highlights). */
export const CODE_LANGUAGES: { value: string; label: string }[] = [
  { value: 'plaintext', label: 'Plain text' },
  { value: 'bash', label: 'Bash' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'css', label: 'CSS' },
  { value: 'go', label: 'Go' },
  { value: 'xml', label: 'HTML / XML' },
  { value: 'java', label: 'Java' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'php', label: 'PHP' },
  { value: 'python', label: 'Python' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'rust', label: 'Rust' },
  { value: 'sql', label: 'SQL' },
  { value: 'swift', label: 'Swift' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'yaml', label: 'YAML' },
]

/**
 * The single source of truth for Quill's document schema. Used by the editor and by the importer
 * tests, so converted documents are validated against exactly what the editor accepts.
 *
 * Compatibility: node names are unchanged from earlier versions (CodeBlockLowlight is still
 * `codeBlock` with a `language` attribute), so existing documents load as before.
 */
export function createExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // Replaced by CodeBlockLowlight below (same node name, adds highlighting).
      codeBlock: false,
      link: {
        openOnClick: false, // clicking places the cursor while editing; Ctrl/Cmd+click opens
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https',
        protocols: ['mailto'],
        // Also enforced in renderHTML by Tiptap: a disallowed href (javascript:, data:, …) never
        // reaches the DOM, even if it is present in stored JSON.
        isAllowedUri: (url) => isSafeUrl(url),
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      },
      // TrailingNode appends an empty paragraph on the first interaction, which is a document
      // change: merely opening and clicking a document would trigger a save and bump updated_at.
      trailingNode: false,
    }),
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: null }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Placeholder.configure({ placeholder: 'Start writing…' }),
    CharacterCount,
  ]
}
