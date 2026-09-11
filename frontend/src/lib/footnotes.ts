/**
 * Evidence footnotes.
 *
 * An answer body may carry standard Markdown footnote references (`[^1]`, `[^2]`) with no
 * definitions anywhere: the numbers point at the answer's own evidence list, in its order. The
 * convention is documented in content/README.md. Rather than teach the Markdown parser about
 * footnotes, `linkFootnotes` rewrites each marker into an ordinary link at the matching evidence
 * row, and components/FootnoteLink.tsx renders those links as superscript markers.
 */

/**
 * One pass over the body. A marker is only rewritten where it is really prose, so the scan also
 * matches the runs it must copy through untouched: a fenced code block, an inline code span (any
 * backtick run, closed by a run of the same length), and a link or image including its label, so
 * a marker written inside one is left as typed rather than turned into broken nested Markdown.
 */
const SCAN =
  /(?:```[\s\S]*?```|(?<ticks>`+)[\s\S]*?\k<ticks>|!?\[(?:[^[\]]|\[[^[\]]*\])*\]\([^()]*\))|\[\^(?<position>\d+)\]/g

/** Every href `linkFootnotes` produces starts with this, and ends with the position. */
export const EVIDENCE_HREF_PREFIX = '#evidence-'

/** The DOM id of the nth evidence row of an answer, counting from 1. */
export function evidenceAnchorId(itemId: string, position: number): string {
  return `evidence-${itemId}-${position}`
}

/**
 * Rewrites `[^n]` into a Markdown link at the nth evidence row. A marker with no matching
 * evidence item, and a marker inside code or inside another link, is left exactly as written, so
 * it reads as the author typed it rather than turning into a dead link or broken Markdown.
 */
export function linkFootnotes(markdown: string, itemId: string, evidenceCount: number): string {
  let rewritten = ''
  let copiedTo = 0

  for (const match of markdown.matchAll(SCAN)) {
    // No position means the scan matched a run to leave alone; it stays in the copied slice.
    const digits = match.groups?.position
    if (digits === undefined) continue

    const position = Number(digits)
    if (position < 1 || position > evidenceCount) continue

    rewritten += markdown.slice(copiedTo, match.index)
    rewritten += `[${position}](#${evidenceAnchorId(itemId, position)})`
    copiedTo = match.index + match[0].length
  }

  return rewritten + markdown.slice(copiedTo)
}

/** The position a footnote href points at, for labelling the marker. */
export function footnotePosition(href: string): string {
  return href.slice(href.lastIndexOf('-') + 1)
}
