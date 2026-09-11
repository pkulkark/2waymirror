import { type ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'

import { CollapseBody, CollapseChevron } from '@/components/Collapse'
import { useCollapse } from '@/lib/collapse'
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
  const { isOpen, reducedMotion, triggerProps, bodyProps } = useCollapse({
    defaultOpen,
    collapsible,
  })

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
        {collapsible && <CollapseChevron open={isOpen} reducedMotion={reducedMotion} />}
      </span>
    </>
  )

  return (
    <section
      id={id}
      className={cn(
        // scroll-mt keeps a jumped-to surface clear of the sticky app bar.
        'flex scroll-mt-48 flex-col overflow-hidden rounded-lg',
        dark ? 'bg-dark' : 'border-surface-border bg-surface border',
      )}
    >
      {collapsible ? (
        // The disclosure pattern: the heading holds the row, the button inside it fills the row.
        <h2 className={headerRow}>
          <button
            {...triggerProps}
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

      <CollapseBody {...bodyProps} className="px-9 pt-7 pb-9">
        {children}
      </CollapseBody>
    </section>
  )
}
