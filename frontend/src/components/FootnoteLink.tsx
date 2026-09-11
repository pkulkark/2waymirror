import type { ComponentPropsWithoutRef } from 'react'

import { TEXT_LINK } from '@/lib/styles'
import { cn } from '@/lib/utils'

type FootnoteLinkProps = ComponentPropsWithoutRef<'a'> & {
  /** react-markdown hands every component the mdast node; it is not a DOM attribute. */
  node?: unknown
  /**
   * The evidence position, put on the node by `remarkFootnoteLinks` and passed through by
   * react-markdown. Only a marker the plugin made carries it, so a link the author wrote to
   * `#evidence-...` by hand still renders as an ordinary link.
   */
  'data-footnote'?: string
}

/**
 * The `a` component for an answer's Markdown: an evidence marker renders as a superscript
 * number, and every other link as a normal anchor.
 */
export function FootnoteLink({
  node,
  'data-footnote': position,
  href,
  children,
  className,
  ...rest
}: FootnoteLinkProps) {
  void node

  if (position !== undefined) {
    return (
      <sup className="align-super leading-[0]">
        <a
          {...rest}
          href={href}
          aria-label={`Evidence ${position}`}
          className={cn(TEXT_LINK, 'text-[12px] font-semibold no-underline', className)}
        >
          {position}
        </a>
      </sup>
    )
  }

  return (
    <a {...rest} href={href} className={cn(TEXT_LINK, className)}>
      {children}
    </a>
  )
}
