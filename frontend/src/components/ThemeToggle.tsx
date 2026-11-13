import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/lib/theme'

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, , toggle] = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      data-testid="theme-toggle"
      className={className}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}
