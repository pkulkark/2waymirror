import type { ReactNode } from 'react'

import Footer from '@/components/Footer'

export interface PageProps {
  /** The app bar block, sticky above the content column. */
  appBar: ReactNode
  children: ReactNode
}

/** The page frame: tinted ground, the app bar, a 960px content column, the footer. */
export default function Page({ appBar, children }: PageProps) {
  return (
    <div className="bg-ground min-h-screen">
      {appBar}
      <main className="mx-auto flex w-[960px] flex-col gap-6 pt-6">{children}</main>
      <Footer />
    </div>
  )
}
