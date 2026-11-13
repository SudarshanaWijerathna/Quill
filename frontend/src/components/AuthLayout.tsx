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

      <aside className="relative hidden overflow-hidden bg-[oklch(0.22_0.08_275)] lg:block" aria-hidden="true">
        <svg
          className="absolute inset-0 size-full"
          viewBox="0 0 1200 1100"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="art-bg" x1="120" y1="80" x2="1050" y2="1040" gradientUnits="userSpaceOnUse">
              <stop stopColor="#172554" />
              <stop offset=".52" stopColor="#4338A8" />
              <stop offset="1" stopColor="#9A4F8D" />
            </linearGradient>
            <linearGradient id="art-ribbon" x1="345" y1="888" x2="944" y2="230" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F9A8D4" />
              <stop offset=".48" stopColor="#C4B5FD" />
              <stop offset="1" stopColor="#67E8F9" />
            </linearGradient>
            <linearGradient id="art-orb" x1="783" y1="182" x2="1048" y2="489" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FDE68A" />
              <stop offset="1" stopColor="#FB7185" />
            </linearGradient>
            <linearGradient id="art-shade" x1="600" y1="640" x2="600" y2="1100" gradientUnits="userSpaceOnUse">
              <stop stopColor="#16153D" stopOpacity="0" />
              <stop offset="1" stopColor="#16153D" stopOpacity=".72" />
            </linearGradient>
            <filter id="art-blur" x="-100" y="-100" width="1400" height="1300" colorInterpolationFilters="sRGB">
              <feGaussianBlur stdDeviation="42" />
            </filter>
          </defs>
          <path fill="url(#art-bg)" d="M0 0h1200v1100H0z" />
          <circle cx="970" cy="170" r="190" fill="#F472B6" fillOpacity=".42" filter="url(#art-blur)" />
          <circle cx="173" cy="770" r="205" fill="#38BDF8" fillOpacity=".35" filter="url(#art-blur)" />
          <path d="M0 104C189 206 270 314 442 308c182-7 214-219 384-228 157-8 255 99 374 54v966H0V104Z" fill="#211D62" fillOpacity=".38" />
          <circle cx="911" cy="350" r="116" fill="url(#art-orb)" fillOpacity=".92" />
          <circle cx="911" cy="350" r="144" stroke="white" strokeOpacity=".24" strokeWidth="2" />
          <circle cx="911" cy="350" r="169" stroke="white" strokeOpacity=".13" strokeWidth="1.5" strokeDasharray="3 12" />
          <path
            d="M333 865c154-69 201-185 286-326 75-125 169-262 326-358-46 140-127 281-230 376-122 113-251 179-382 308Z"
            fill="url(#art-ribbon)"
            fillOpacity=".92"
          />
          <path d="M379 842c174-91 308-254 474-532M427 789c53-92 112-174 175-246m-86 288c87-94 184-172 292-235M537 674c92-39 177-94 253-165" stroke="#fff" strokeOpacity=".65" strokeWidth="3" strokeLinecap="round" />
          <path d="M297 935c84-27 172-82 256-158 70-64 127-145 188-238" stroke="#FBCFE8" strokeWidth="22" strokeLinecap="round" strokeOpacity=".85" />
          <path d="M605 982c169-31 288-138 375-260" stroke="#A5F3FC" strokeOpacity=".76" strokeWidth="8" strokeLinecap="round" />
          <path d="m248 374 11 26 26 11-26 11-11 26-11-26-26-11 26-11 11-26Zm706 385 8 19 19 8-19 8-8 19-8-19-19-8 19-8 8-19Z" fill="#FEF3C7" />
          <circle cx="254" cy="574" r="7" fill="#F9A8D4" />
          <circle cx="1047" cy="654" r="10" fill="#A5F3FC" />
          <circle cx="709" cy="182" r="5" fill="white" fillOpacity=".8" />
          <path d="M0 590c214-79 317-3 465-33 198-40 270-180 410-201 119-18 205 35 325 5v739H0V590Z" fill="url(#art-shade)" />
        </svg>
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Logo inverted />
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
