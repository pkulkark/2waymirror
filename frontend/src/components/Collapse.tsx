import { type ReactNode } from 'react'
import { ChevronUp } from 'lucide-react'

import type { CollapseBodyState } from '@/lib/collapse'
import { cn } from '@/lib/utils'

/** The chevron on a disclosure trigger. It points up when open and rotates as the body moves. */
export function CollapseChevron({
  open,
  reducedMotion,
  className,
}: {
  open: boolean
  reducedMotion: boolean
  className?: string
}) {
  return (
    <ChevronUp
      aria-hidden="true"
      strokeWidth={1.4}
      className={cn(
        'size-4 shrink-0',
        !reducedMotion && 'transition-transform duration-200 ease-out',
        !open && 'rotate-180',
        className,
      )}
    />
  )
}

/**
 * The collapsing body of a disclosure, driven by `useCollapse`. The grid-rows trick animates to
 * the content's own height without measuring it; the body is inert while closed so nothing
 * inside it takes focus.
 */
export function CollapseBody({
  id,
  open,
  reducedMotion,
  className,
  children,
}: CollapseBodyState & {
  /** Classes for the inner content wrapper, e.g. the body padding. */
  className?: string
  children: ReactNode
}) {
  return (
    <div
      id={id}
      data-state={open ? 'open' : 'closed'}
      inert={!open}
      className={cn(
        'grid',
        !reducedMotion && 'transition-[grid-template-rows] duration-200 ease-out',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className="overflow-hidden">
        <div className={className}>{children}</div>
      </div>
    </div>
  )
}
