import { Toaster } from 'sonner'
import { useTheme } from '@/lib/theme'

export function ThemedToaster() {
  const [theme] = useTheme()
  return <Toaster position="bottom-right" richColors closeButton theme={theme} />
}
