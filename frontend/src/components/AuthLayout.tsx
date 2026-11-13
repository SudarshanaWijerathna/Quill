import type { ReactNode } from 'react'
import { Logo } from '@/components/Logo'

/** Split layout: form on the left, brand panel on the right (hidden on small screens). */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-center text-sm text-muted-foreground">{footer}</p>
        </main>
      </div>

      <aside className="relative hidden overflow-hidden bg-[oklch(0.32_0.11_262)] lg:block" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(0.45_0.14_260/0.6),transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Logo inverted />
          <div className="mx-auto w-full max-w-md">
            {/* Stylized document preview */}
            <div className="rounded-xl bg-white p-8 shadow-2xl shadow-black/20">
              <div className="h-4 w-2/3 rounded bg-slate-800/90" />
              <div className="mt-6 space-y-2.5">
                <div className="h-2.5 w-full rounded bg-slate-200" />
                <div className="h-2.5 w-11/12 rounded bg-slate-200" />
                <div className="h-2.5 w-4/5 rounded bg-slate-200" />
              </div>
              <div className="mt-6 space-y-2.5 pl-4">
                {[0.75, 0.6, 0.7].map((w, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-[oklch(0.32_0.11_262)]" />
                    <div className="h-2.5 rounded bg-slate-200" style={{ width: `${w * 100}%` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div>
            <p className="text-2xl font-medium leading-snug tracking-tight">
              Write, organize and share documents — without the clutter.
            </p>
            <p className="mt-3 text-sm text-white/70">
              Rich-text editing, Markdown import and simple sharing in one calm workspace.
            </p>
          </div>
        </div>
      </aside>
    </div>
  )
}
