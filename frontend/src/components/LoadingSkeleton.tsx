import type { ReactNode } from 'react'

import Page from '@/components/Page'
import { Skeleton } from '@/components/ui/skeleton'

/** The placeholder colour for blocks sitting on the dark app bar. */
const ON_DARK = 'bg-skeleton-on-dark'

/**
 * The six body lines of the second surface, in the mockup's widths. Written out as classes
 * rather than built from numbers, so Tailwind's scanner still finds them.
 */
const BODY_LINES = ['w-[680px]', 'w-[660px]', 'w-[640px]', 'w-[600px]', 'w-[620px]', 'w-[400px]']

/** The three tab blocks, whose widths follow the real tab labels in the mockup. */
const TAB_WIDTHS = ['w-[90px]', 'w-[90px]', 'w-[120px]']

/**
 * The app bar's shape without its content: same fill, same four rows, same heights, so the
 * real bar drops into place without the page moving. It mirrors AppBar rather than reusing
 * it, because AppBar renders text and links, and a bar of empty strings would collapse.
 */
function LoadingAppBar() {
  return (
    <header aria-hidden="true" className="bg-dark sticky top-0 z-50">
      <div className="mx-auto flex w-[960px] flex-col">
        {/* Row 1: the name, the status chip, the session chip. */}
        <div className="flex h-14 items-center justify-between gap-6">
          <Skeleton className={`h-5 w-[140px] ${ON_DARK}`} />
          <div className="flex items-center gap-3">
            <Skeleton className={`h-7 w-[160px] rounded-full ${ON_DARK}`} />
            <Skeleton className={`h-7 w-[160px] rounded-full ${ON_DARK}`} />
          </div>
        </div>

        {/* Rows 2 and 3: the headline and the profile links. Neither row has a set height in
            AppBar, so the blocks stand as tall as the text they replace: 15px at 1.4 is 21px. */}
        <div className="flex flex-col items-start gap-2.5 pb-4">
          <Skeleton className={`h-[21px] w-[360px] ${ON_DARK}`} />
          <div className="flex items-center gap-5">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className={`h-[21px] w-[70px] ${ON_DARK}`} />
            ))}
          </div>
        </div>

        {/* Row 4: the tabs. */}
        <div className="flex h-11 items-center gap-8">
          {TAB_WIDTHS.map((width, index) => (
            <Skeleton key={index} className={`h-[15px] ${width} ${ON_DARK}`} />
          ))}
        </div>
      </div>
    </header>
  )
}

/** A surface's shape: the tinted header row with a title block, then the body. */
function SkeletonSurface({ children }: { children: ReactNode }) {
  return (
    <section className="border-surface-border bg-surface flex flex-col overflow-hidden rounded-lg border">
      <div className="bg-moss-tint flex h-[52px] items-center px-9">
        <Skeleton className="h-6 w-[200px]" />
      </div>
      <div className="px-9 pt-7 pb-9">{children}</div>
    </section>
  )
}

/**
 * The loading state: the page's own shape in placeholder blocks, per
 * docs/design/mockups/Loading.dc.html. The blocks pulse over 1.6s and hold still under
 * prefers-reduced-motion, both from the Skeleton component.
 */
export default function LoadingSkeleton() {
  return (
    <Page appBar={<LoadingAppBar />}>
      <div aria-busy="true" className="flex flex-col gap-6">
        {/* Polite, so a screen reader says "Loading" once the region is in rather than
            interrupting whatever it was reading. */}
        <span aria-live="polite" className="sr-only">
          Loading
        </span>

        {/* Logistics: four rows of a label over a value, hairline between. The blocks take the
            heights of the real row in SessionPage: a 13px label at 1.4 is 18px, a 17px value
            23.8px, so the rows do not move when the content lands. */}
        <SkeletonSurface>
          <div className="flex flex-col">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className="border-hairline flex flex-col gap-1 border-t py-3.5 first:border-t-0"
              >
                <Skeleton className="h-[18px] w-[90px]" />
                <Skeleton className="h-6 w-[320px]" />
              </div>
            ))}
          </div>
        </SkeletonSurface>

        {/* The first answer section: prose lines. */}
        <SkeletonSurface>
          <div className="flex flex-col gap-3">
            {BODY_LINES.map((width) => (
              <Skeleton key={width} className={`h-3.5 ${width}`} />
            ))}
          </div>
        </SkeletonSurface>
      </div>
    </Page>
  )
}
