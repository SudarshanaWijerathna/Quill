import type { Editor } from '@tiptap/react'

export interface LinkDialogState {
  href: string
  /** True when nothing is selected: the dialog also asks for the text to insert as the link. */
  needsText: boolean
  isEditing: boolean
}

/** Read the selection/cursor to decide whether we're adding or editing a link. */
export function readLinkState(editor: Editor): LinkDialogState {
  const href = (editor.getAttributes('link').href as string | undefined) ?? ''
  return { href, needsText: editor.state.selection.empty && !href, isEditing: !!href }
}
