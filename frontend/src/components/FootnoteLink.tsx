import type { ComponentPropsWithoutRef } from 'react'

import { EVIDENCE_HREF_PREFIX, footnotePosition } from '@/lib/footnotes'
import { cn } from '@/lib/utils'

type FootnoteLinkProps = ComponentPropsWithoutRef<'a'> & {
  /** react-markdown hands every component the mdast node; it is not a DOM attribute. */
  node?: unknown
}

/**
 * The `a` component for an answer's Markdown: a link that `linkFootnotes` produced renders as a
 * superscript evidence marker, and every other link as a normal anchor.
 */
export function FootnoteLink({ node, href, children, className, ...rest }: FootnoteLinkProps) {
  void node

  if (href?.startsWith(EVIDENCE_HREF_PREFIX)) {
    return (
      <sup className="align-super leading-[0]">
        <a
          {...rest}
          href={href}
          aria-label={`Evidence ${footnotePosition(href)}`}
          className={cn('text-moss hover:text-moss-hover text-[12px] font-semibold', className)}
        >
          {children}
        </a>
      </sup>
    )
  }

  return (
    <a
      {...rest}
      href={href}
      className={cn('text-moss hover:text-moss-hover underline underline-offset-2', className)}
    >
      {children}
    </a>
  )
}
