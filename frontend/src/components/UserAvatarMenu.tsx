import { LogOut } from 'lucide-react'
import { useAuth } from '@/auth/auth-context'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { initials } from '@/lib/format'

/** Compact avatar button with the account menu (used in the editor header). */
export function UserAvatarMenu() {
  const { user, logout } = useAuth()
  if (!user) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account: ${user.name}`}
        title={user.name}
        data-testid="user-avatar"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {initials(user.name)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
