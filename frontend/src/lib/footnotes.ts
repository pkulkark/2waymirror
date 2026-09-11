import type { Link, PhrasingContent, Root } from 'mdast'
import { SKIP, visit } from 'unist-util-visit'

/**
 * Evidence footnotes.
 *
 * An answer body may carry standard Markdown footnote references (`[^1]`, `[^2]`) with no
 * definitions anywhere: the numbers point at the answer's own evidence list, in its order. The
 * convention is documented in content/README.md. Nothing rewrites the Markdown source; the
 * remark plugin below rewrites the parsed tree instead, so a marker is only ever turned into a
 * link where the parser already decided the text is prose.
 */

/** Splits a text node on a footnote marker, keeping the position as a capture. */
const MARKER = /\[\^(\d+)\]/

/** The DOM id of the nth evidence row of an answer, counting from 1. */
export function evidenceAnchorId(itemId: string, position: number): string {
  return `evidence-${itemId}-${position}`
}

export interface FootnoteLinkOptions {
  /** The answer the markers belong to; its evidence rows carry the matching anchor ids. */
  itemId: string
  /** How many evidence rows the answer has. A marker past the last one is left as written. */
  evidenceCount: number
}

/** Appends a run of plain text, merging it into the text node before it where there is one. */
function pushText(nodes: PhrasingContent[], value: string): void {
  if (!value) return

  const last = nodes.at(-1)
  if (last?.type === 'text') {
    last.value += value
    return
  }
  nodes.push({ type: 'text', value })
}

/**
 * The marker as a link node. The url is set on the node rather than written back as Markdown, so
 * an id holding a space or a parenthesis needs no escaping, and `hProperties` tags the element so
 * that FootnoteLink can tell a marker from a link the author wrote by hand.
 */
function markerLink(itemId: string, position: number): Link {
  return {
    type: 'link',
    url: `#${evidenceAnchorId(itemId, position)}`,
    data: { hProperties: { 'data-footnote': String(position) } },
    children: [{ type: 'text', value: String(position) }],
  }
}

/**
 * A remark plugin that turns `[^n]` into a link at the answer's nth evidence row.
 *
 * Only `text` nodes are visited, so a marker inside code or inline code is already safe: the
 * parser gives those their own node types and never puts text inside them. Links, link
 * references and images are skipped along with everything under them, so a marker written inside
 * a link label stays as the author typed it rather than becoming a nested link. A marker with no
 * matching evidence row is left as text too.
 */
export function remarkFootnoteLinks({ itemId, evidenceCount }: FootnoteLinkOptions) {
  /** The nodes a text value becomes, or undefined when it holds no marker worth rewriting. */
  function rewrite(value: string): PhrasingContent[] | undefined {
    const parts = value.split(MARKER)
    if (parts.length === 1) return undefined

    const nodes: PhrasingContent[] = []
    let rewrote = false

    parts.forEach((part, index) => {
      // Odd parts are the captured positions; even parts are the text between them.
      if (index % 2 === 0) {
        pushText(nodes, part)
        return
      }

      const position = Number(part)
      if (position < 1 || position > evidenceCount) {
        pushText(nodes, `[^${part}]`)
        return
      }

      nodes.push(markerLink(itemId, position))
      rewrote = true
    })

    return rewrote ? nodes : undefined
  }

  return (tree: Root) => {
    visit(tree, (node, index, parent) => {
      if (node.type === 'link' || node.type === 'linkReference' || node.type === 'image') {
        return SKIP
      }
      if (node.type !== 'text' || !parent || index === undefined) return

      const nodes = rewrite(node.value)
      if (!nodes) return

      // The parent of a text node always holds phrasing content, whatever the union says.
      ;(parent.children as PhrasingContent[]).splice(index, 1, ...nodes)
      return [SKIP, index + nodes.length]
    })
  }
}
