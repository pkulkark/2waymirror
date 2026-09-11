import ReactMarkdown, { type Components } from 'react-markdown'

import type { SectionItem } from '@/api'
import { CollapseBody, CollapseChevron } from '@/components/Collapse'
import { FootnoteLink } from '@/components/FootnoteLink'
import { useCollapse } from '@/lib/collapse'
import { evidenceAnchorId, linkFootnotes } from '@/lib/footnotes'

export interface AnswerProps {
  item: SectionItem
  defaultOpen?: boolean
}

/**
 * The prose of an answer body. react-markdown gets an explicit component per element rather
 * than a typography plugin, so every size and colour here is the one in
 * docs/design/mockups/DeepDive.dc.html.
 */
const PROSE: Components = {
  p: ({ children }) => <p className="text-ink font-serif text-[17px] leading-[1.6]">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="text-ink flex list-disc flex-col gap-2 pl-5 font-serif text-[17px] leading-[1.6]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="text-ink flex list-decimal flex-col gap-2 pl-5 font-serif text-[17px] leading-[1.6]">
      {children}
    </ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  a: FootnoteLink,
  code: ({ children }) => <code className="font-sans text-[15px]">{children}</code>,
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
              className="text-moss hover:text-moss-hover font-sans text-[15px] leading-[1.4]"
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
  const body = linkFootnotes(item.answer_md, item.id, item.evidence.length)

  return (
    <div className="flex flex-col">
      {/* The disclosure pattern: the heading holds the row, the button inside it fills the row. */}
      <h3 className="flex">
        <button
          {...triggerProps}
          className="focus-visible:outline-moss flex w-full cursor-pointer items-baseline justify-between gap-6 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
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
        <div className="flex flex-col gap-4">
          <ReactMarkdown components={PROSE}>{body}</ReactMarkdown>
        </div>
        {item.evidence.length > 0 && <EvidenceList item={item} />}
      </CollapseBody>
    </div>
  )
}
