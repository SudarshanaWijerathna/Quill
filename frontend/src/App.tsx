import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { RedirectIfAuthenticated, RequireAuth } from '@/auth/guards'
import { AppLayout } from '@/components/AppLayout'
import DashboardPage from '@/pages/DashboardPage'
import LoginPage from '@/pages/LoginPage'
import { SharedPage, TrashPage } from '@/pages/SidebarPages'
import RegisterPage from '@/pages/RegisterPage'

// The editor (Tiptap + ProseMirror) is the heaviest part of the app; load it only when needed.
const DocumentPage = lazy(() => import('@/pages/DocumentPage'))

function PageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<RedirectIfAuthenticated />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/shared" element={<SharedPage />} />
          <Route path="/trash" element={<TrashPage />} />
        </Route>
        {/* Full-screen document view (no sidebar) */}
        <Route
          path="/documents/:id"
          element={
            <Suspense fallback={<PageSpinner />}>
              <DocumentPage />
            </Suspense>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
