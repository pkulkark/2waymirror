import type { ReactNode } from 'react'

import Footer from '@/components/Footer'
import { cn } from '@/lib/utils'

export interface PageProps {
  /** The app bar block, sticky above the content column. */
  appBar: ReactNode
  children: ReactNode
  /** The public project page has its own links and opening spacing. */
  footer?: ReactNode
  mainClassName?: string
}

/** The page frame: tinted ground, the app bar, a 960px content column, the footer. */
export default function Page({ appBar, children, footer = <Footer />, mainClassName }: PageProps) {
  return (
    <div className="bg-ground min-h-screen">
      {appBar}
      <main className={cn('mx-auto flex w-[960px] flex-col gap-6 pt-6', mainClassName)}>
        {children}
      </main>
      {footer}
    </div>
  )
}
