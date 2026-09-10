import { useId, useState, type ReactNode } from 'react'
import { ChevronUp, type LucideIcon } from 'lucide-react'

import { useReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'

export interface SurfaceProps {
  title: string
  icon?: LucideIcon
  /** Right-hand count on the header row, e.g. "4 items" or "2 answers". */
  count?: string
  collapsible?: boolean
  defaultOpen?: boolean
  /** The questions surface: dark fill, no border, no icon. */
  dark?: boolean
  /** DOM id, so a tab can jump to the surface within the page. */
  id?: string
  children: ReactNode
}

/**
 * A section surface: a tinted 52px header row that toggles the body.
 * Measurements come from docs/design/mockups/Screening.dc.html.
 */
export default function Surface({
  title,
  icon: Icon,
  count,
  collapsible = true,
  defaultOpen = true,
  dark = false,
  id,
  children,
}: SurfaceProps) {
  const [open, setOpen] = useState(defaultOpen)
  const reducedMotion = useReducedMotion()
  const bodyId = useId()
  const isOpen = collapsible ? open : true

  const headerRow = cn('flex h-[52px] items-center', dark ? 'bg-dark-input' : 'bg-moss-tint')
  const headerInner = 'flex w-full items-center justify-between gap-6 px-9'

  const headerContent = (
    <>
      <span className="flex items-center gap-3">
        {Icon && (
          <Icon
            aria-hidden="true"
            strokeWidth={1.4}
            className={cn('size-[18px] shrink-0', dark ? 'text-on-dark' : 'text-moss')}
          />
        )}
        <span
          className={cn(
            'font-serif text-[22px] leading-[1.2] font-medium',
            dark ? 'text-on-dark' : 'text-ink',
          )}
        >
          {title}
        </span>
      </span>
      <span
        className={cn(
          'flex items-center gap-3 text-[13px] leading-[1.4] font-semibold',
          dark ? 'text-on-dark-muted' : 'text-muted-ink',
        )}
      >
        {count && <span>{count}</span>}
        {collapsible && (
          <ChevronUp
            aria-hidden="true"
            strokeWidth={1.4}
            className={cn(
              'size-4 shrink-0',
              !reducedMotion && 'transition-transform duration-200 ease-out',
              !isOpen && 'rotate-180',
            )}
          />
        )}
      </span>
    </>
  )

  return (
    <section
      id={id}
      className={cn(
        'flex flex-col overflow-hidden rounded-lg',
        dark ? 'bg-dark' : 'border-surface-border bg-surface border',
      )}
    >
      {collapsible ? (
        // The disclosure pattern: the heading holds the row, the button inside it fills the row.
        <h2 className={headerRow}>
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={bodyId}
            onClick={() => setOpen((previous) => !previous)}
            className={cn(
              headerInner,
              'focus-visible:outline-moss h-full cursor-pointer text-left focus-visible:outline-2 focus-visible:-outline-offset-2',
            )}
          >
            {headerContent}
          </button>
        </h2>
      ) : (
        <h2 className={cn(headerRow, headerInner)}>{headerContent}</h2>
      )}

      <div
        id={bodyId}
        data-state={isOpen ? 'open' : 'closed'}
        inert={!isOpen}
        className={cn(
          'grid',
          !reducedMotion && 'transition-[grid-template-rows] duration-200 ease-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="px-9 pt-7 pb-9">{children}</div>
        </div>
      </div>
    </section>
  )
}
