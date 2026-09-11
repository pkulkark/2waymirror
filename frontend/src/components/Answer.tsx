import type { ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'

import type { SectionItem } from '@/api'
import { CollapseBody, CollapseChevron } from '@/components/Collapse'
import { FootnoteLink } from '@/components/FootnoteLink'
import { useCollapse } from '@/lib/collapse'
import { evidenceAnchorId, remarkFootnoteLinks } from '@/lib/footnotes'
import { FOCUS_RING, TEXT_LINK } from '@/lib/styles'
import { cn } from '@/lib/utils'

export interface AnswerProps {
  item: SectionItem
  defaultOpen?: boolean
}

/**
 * The prose type, set once on the wrapper so every element inherits it, plus the two elements
 * that need a rule of their own. Code is styled from here rather than through a `code` component
 * because only the selector can tell an inline span from the one inside a `pre`.
 */
const PROSE_CLASSES = cn(
  'text-ink flex flex-col gap-4 font-serif text-[17px] leading-[1.6]',
  '[&_:not(pre)>code]:bg-moss-tint [&_:not(pre)>code]:rounded-[4px] [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:font-sans [&_:not(pre)>code]:text-[15px]',
  '[&_pre]:bg-moss-tint [&_pre]:overflow-x-auto [&_pre]:rounded-[8px] [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-[14px]',
)

/**
 * Any heading level in an answer body renders as an h4: the question above it is the h3, so this
 * is the next level down however deep the author nested it.
 */
function ProseHeading({ children }: { children?: ReactNode }) {
  return <h4 className="mt-2 font-serif text-[20px] leading-[1.3] font-medium">{children}</h4>
}

/**
 * react-markdown gets an explicit component per element rather than a typography plugin, so
 * every size and colour here is the one in docs/design/mockups/DeepDive.dc.html.
 */
const PROSE: Components = {
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="flex list-disc flex-col gap-2 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="flex list-decimal flex-col gap-2 pl-5">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  h1: ProseHeading,
  h2: ProseHeading,
  h3: ProseHeading,
  h4: ProseHeading,
  h5: ProseHeading,
  h6: ProseHeading,
  blockquote: ({ children }) => (
    <blockquote className="border-hairline text-muted-ink border-l-2 pl-4">{children}</blockquote>
  ),
  hr: () => <hr className="border-hairline" />,
  a: FootnoteLink,
}

/** "1 evidence", "4 evidence": the noun does not take a plural. */
function evidenceCount(count: number): string {
  return `${count} evidence`
}

function EvidenceList({ item }: { item: SectionItem }) {
  return (
    <div className="flex flex-col gap-2.5 pt-2">
      <div className="text-muted-ink text-[13px] leading-[1.4] font-semibold">Evidence</div>
      <ul className="flex flex-col gap-2.5">
        {item.evidence.map((evidence, index) => (
          <li
            // The footnote markers in the prose link here, so the row keeps clear of the app bar.
            id={evidenceAnchorId(item.id, index + 1)}
            key={evidenceAnchorId(item.id, index + 1)}
            className="flex scroll-mt-48 items-center gap-2.5"
          >
            <span className="bg-moss-tint text-moss flex size-[22px] shrink-0 items-center justify-center rounded-full text-[12px] leading-none font-semibold">
              {index + 1}
            </span>
            <a
              href={evidence.url}
              target="_blank"
              rel="noreferrer"
              className={cn(TEXT_LINK, 'font-sans text-[15px] leading-[1.4]')}
            >
              {evidence.label}
            </a>
            {evidence.type && (
              <span className="text-muted-ink text-[13px] leading-[1.4]">{evidence.type}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * One answer: a header row that toggles the body, then the summary, the prose, and the evidence
 * list. Measurements come from docs/design/mockups/Screening.dc.html and DeepDive.dc.html.
 */
export default function Answer({ item, defaultOpen = true }: AnswerProps) {
  const { isOpen, reducedMotion, triggerProps, bodyProps } = useCollapse({ defaultOpen })

  return (
    <div className="flex flex-col">
      {/* The disclosure pattern: the heading holds the row, the button inside it fills the row. */}
      <h3 className="flex">
        <button
          {...triggerProps}
          className={cn(
            'flex w-full cursor-pointer items-baseline justify-between gap-6 text-left',
            FOCUS_RING,
          )}
        >
          <span className="text-ink font-serif text-[20px] leading-[1.3] font-medium">
            {item.question}
          </span>
          <span className="text-muted-ink flex shrink-0 items-center gap-3 text-[13px] leading-[1.4]">
            {item.evidence.length > 0 && <span>{evidenceCount(item.evidence.length)}</span>}
            <CollapseChevron open={isOpen} reducedMotion={reducedMotion} />
          </span>
        </button>
      </h3>

      <CollapseBody {...bodyProps} className="flex flex-col gap-3 pt-3">
        {item.summary && (
          <p className="text-ink font-serif text-[18px] leading-[1.45] italic">{item.summary}</p>
        )}
        <div className={PROSE_CLASSES}>
          <ReactMarkdown
            components={PROSE}
            remarkPlugins={[
              [remarkFootnoteLinks, { itemId: item.id, evidenceCount: item.evidence.length }],
            ]}
          >
            {item.answer_md}
          </ReactMarkdown>
        </div>
        {item.evidence.length > 0 && <EvidenceList item={item} />}
      </CollapseBody>
    </div>
  )
}
