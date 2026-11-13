export interface User {
  id: number
  email: string
  name: string
  created_at: string
}

/** Another user as visible to collaborators. */
export interface UserPublic {
  id: number
  name: string
  email: string
}

/** The current user's role on a document. */
export type Role = 'owner' | 'editor' | 'viewer'
export type SharePermission = Exclude<Role, 'owner'>
/** The three sharing levels shown in the UI (stored as permission + can_download). */
export type AccessLevel = 'viewer' | 'viewer_download' | 'editor'

export interface DocumentSummary {
  id: string
  title: string
  preview: string
  owner_id: number
  owner: UserPublic
  role: Role
  /** Whether the current user may download, export, copy or print. */
  can_download: boolean
  created_at: string
  updated_at: string
}

/** Tiptap/ProseMirror JSON document. */
export type DocumentContent = Record<string, unknown>

export interface DocumentDetail extends Omit<DocumentSummary, 'preview'> {
  content: DocumentContent
}

export interface Share {
  user: UserPublic
  permission: SharePermission
  can_download: boolean
  created_at: string
}

export function accessLevel(permission: SharePermission, canDownload: boolean): AccessLevel {
  if (permission === 'editor') return 'editor'
  return canDownload ? 'viewer_download' : 'viewer'
}

export function levelToShare(level: AccessLevel): { permission: SharePermission; can_download: boolean } {
  if (level === 'editor') return { permission: 'editor', can_download: true }
  return { permission: 'viewer', can_download: level === 'viewer_download' }
}
